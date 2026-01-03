import { getDb } from "@/db";
import { SqlitePracticeSessionRepository } from "@/db/repositories/sqlitePracticeSessionRepository";

export const practiceSessionRepository =
  new SqlitePracticeSessionRepository(getDb);
