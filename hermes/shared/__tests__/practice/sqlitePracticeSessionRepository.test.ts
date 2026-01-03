import fs from "fs";
import path from "path";

import { registerPracticeItems } from "../../domain/practice/registerPracticeItems";
import { practiceItemRegistry } from "../../domain/practice/practiceItemRegistry";
import type { SQLiteDatabase } from "expo-sqlite";

import { SqlitePracticeSessionRepository } from "../../../src/db/repositories/sqlitePracticeSessionRepository";

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

class FakeDb {
  private sessionAuto = 1;
  private attemptAuto = 1;

  public sessions: any[] = [];
  public attempts: any[] = [];
  public attemptConcepts: any[] = [];

  async withTransactionAsync(fn: () => Promise<void>) {
    await fn();
  }

  async runAsync(sql: string, ...params: any[]) {
    if (sql.includes("INSERT INTO practice_sessions")) {
      const id = this.sessionAuto++;
      this.sessions.push({
        id,
        language_id: params[0],
        user_id: params[1],
        started_at: params[2],
        completed_at: null,
        modality: params[3],
        source: params[4],
        notes: params[5],
      });
      return { lastInsertRowId: id };
    }

    if (sql.includes("INSERT INTO practice_attempts")) {
      const id = this.attemptAuto++;
      this.attempts.push({
        id,
        session_id: params[0],
        user_id: params[1],
        modality: params[2],
        type: params[3],
        prompt_text: params[4],
        question_json: params[5],
        user_response_json: params[6],
        evaluation_json: params[7],
        created_at: params[8],
      });
      return { lastInsertRowId: id };
    }

    if (sql.includes("INSERT INTO practice_attempt_concepts")) {
      this.attemptConcepts.push({
        attempt_id: params[0],
        concept_id: params[1],
        score: params[2],
        is_correct: params[3],
        weight: params[4],
        evidence_json: params[5],
        created_at: params[6],
      });
      return { lastInsertRowId: 0 };
    }

    if (sql.includes("UPDATE practice_sessions")) {
    const completed_at = params[0];
    const modality = params[1];
    const source = params[2];
    const notes = params[3];
    const id = Number(params[4]);

    const s = this.sessions.find((x) => x.id === id);
    if (s) {
        s.completed_at = completed_at;
        if (modality != null) s.modality = modality;
        if (source != null) s.source = source;
        if (notes != null) s.notes = notes;
    }
    return { changes: 1 };
    }


    throw new Error("FakeDb.runAsync unexpected SQL: " + sql);
  }
}

describe("SqlitePracticeSessionRepository wiring", () => {
  const FIXTURES_DIR = path.join(__dirname, "fixtures");
  const ITEMS_DIR = path.join(FIXTURES_DIR, "items");
  const SUBS_DIR = path.join(FIXTURES_DIR, "submissions");

  beforeAll(() => {
    registerPracticeItems();
  });

  test("start session → record attempt → insert concept rows → complete session", async () => {
    const fake = new FakeDb();
    const repo = new SqlitePracticeSessionRepository(async () => fake as unknown as SQLiteDatabase);

    const sessionId = await repo.startSession({
      languageId: 1,
      userId: 42,
      modality: "reception",
      source: "jest",
      notes: "test run",
    });

    expect(sessionId).toBeGreaterThan(0);
    expect(fake.sessions.length).toBe(1);

    const itemJson = readJson(path.join(ITEMS_DIR, "flashcard_v1.basic.json"));
    const item = practiceItemRegistry.create(itemJson);

    const goodSub = readJson(path.join(SUBS_DIR, "flashcard_v1.basic.good.json"));
    const evalResult = item.evaluate(goodSub);

    const attemptId = await repo.recordAttempt({
      sessionId,
      userId: 42,
      modality: item.mode, // optional
      item,
      promptText: (itemJson.front ?? itemJson.prompt ?? "prompt") as string,
      userResponse: goodSub,
      evaluation: evalResult,
    });

    expect(attemptId).toBeGreaterThan(0);
    expect(fake.attempts.length).toBe(1);

    const expectedConceptRows = evalResult.conceptResults?.length ?? 0;
    expect(fake.attemptConcepts.length).toBe(expectedConceptRows);

    await repo.completeSession({
      sessionId,
      notes: "completed",
    });

    expect(fake.sessions[0].completed_at).toBeTruthy();
    expect(fake.sessions[0].notes).toBe("completed");
  });

  test("record attempt without conceptResults does not fail", async () => {
    const fake = new FakeDb();
    const repo = new SqlitePracticeSessionRepository(async () => fake as unknown as SQLiteDatabase);

    const sessionId = await repo.startSession({ languageId: 1, userId: 1 });

    const itemJson = readJson(path.join(ITEMS_DIR, "flashcard_v1.basic.json"));
    const item = practiceItemRegistry.create(itemJson);

    const attemptId = await repo.recordAttempt({
      sessionId,
      userId: 1,
      item,
      userResponse: { revealed: true, confidence: "unknown" },
      evaluation: {
        type: item.type,
        mode: item.mode,
        skills: item.skills,
        score: 0,
        conceptResults: [],
      },
    });

    expect(attemptId).toBeGreaterThan(0);
    expect(fake.attemptConcepts.length).toBe(0);
  });
});
