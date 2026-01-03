import type {
  PracticeSessionRepository,
  StartPracticeSessionInput,
  RecordPracticeAttemptInput,
  CompletePracticeSessionInput,
} from "../../../shared/domain/practice/ports/practiceSessionRepository";

interface DbLike {
  runAsync(sql: string, ...params: any[]): Promise<any>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

type DbProvider = () => Promise<DbLike>;

export class SqlitePracticeSessionRepository implements PracticeSessionRepository {
  private readonly getDb: DbProvider;

  constructor(getDbProvider: DbProvider) {
    this.getDb = getDbProvider;
  }

  async startSession(input: StartPracticeSessionInput): Promise<number> {
    const db = await this.getDb();
    const startedAt = new Date().toISOString();

    const result = await db.runAsync(
      `INSERT INTO practice_sessions
        (language_id, user_id, started_at, completed_at, modality, source, notes)
       VALUES (?, ?, ?, NULL, ?, ?, ?);`,
      ...[
        input.languageId,
        input.userId,
        startedAt,
        input.modality ?? null,
        input.source ?? null,
        input.notes ?? null,
      ]
    );

    return Number(result.lastInsertRowId);
  }

  async recordAttempt(input: RecordPracticeAttemptInput): Promise<number> {
    const db = await this.getDb();
    const createdAt = new Date().toISOString();

    const itemJson = input.item.toJSON();

    let attemptId = -1;

    await db.withTransactionAsync(async () => {
      const res = await db.runAsync(
        `INSERT INTO practice_attempts
          (session_id, user_id, modality, type, prompt_text, question_json, user_response_json, evaluation_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        ...[
          input.sessionId,
          input.userId,
          input.modality ?? input.item.mode ?? null,
          input.item.type,
          input.promptText ?? null,
          JSON.stringify(itemJson),
          input.userResponse != null ? JSON.stringify(input.userResponse) : null,
          input.evaluation != null ? JSON.stringify(input.evaluation) : null,
          createdAt,
        ]
      );

      attemptId = Number(res.lastInsertRowId);

      const conceptResults = input.evaluation?.conceptResults ?? [];
      for (const cr of conceptResults) {
        await db.runAsync(
          `INSERT INTO practice_attempt_concepts
            (attempt_id, concept_id, score, is_correct, weight, evidence_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          ...[
            attemptId,
            cr.conceptId,
            cr.score ?? null,
            cr.isCorrect == null ? null : cr.isCorrect ? 1 : 0,
            cr.weight ?? null,
            cr.evidence == null ? null : JSON.stringify(cr.evidence),
            createdAt,
          ]
        );
      }
    });

    return attemptId;
  }

  async completeSession(input: CompletePracticeSessionInput): Promise<void> {
    const db = await this.getDb();
    const completedAt = new Date().toISOString();

    await db.runAsync(
      `UPDATE practice_sessions
       SET completed_at = ?,
           modality = COALESCE(?, modality),
           source = COALESCE(?, source),
           notes = COALESCE(?, notes)
       WHERE id = ?;`,
      ...[
        completedAt,
        input.modality ?? null,
        input.source ?? null,
        input.notes ?? null,
        input.sessionId,
      ]
    );
  }
}
