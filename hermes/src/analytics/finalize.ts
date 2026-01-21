// src/analytics/finalizePracticeSession.ts
import * as SQLite from "expo-sqlite";
import { completePracticeSession } from "@/db/queries/sessions";

export async function finalizePracticeSession(
  db: SQLite.SQLiteDatabase,
  sessionId: number
) {
  await completePracticeSession(db, {
    sessionId,
    completedAtIso: new Date().toISOString(),
  });
}
