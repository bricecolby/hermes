import type { PracticeItemJSON, EvaluationResult } from "../practiceItem";
import type { PracticeItem } from "../practiceItem";

export type StartPracticeSessionInput = {
  languageId: number;
  userId: number;
  modality?: string;
  source?: string;
  notes?: string;
};

export type RecordPracticeAttemptInput = {
  sessionId: number;
  userId: number;

  modality?: string; 
  item: PracticeItem; 
  promptText?: string;

  userResponse?: unknown; 
  evaluation?: EvaluationResult; 
};

export type CompletePracticeSessionInput = {
  sessionId: number;
  modality?: string;
  source?: string;
  notes?: string;
};

export interface PracticeSessionRepository {
  startSession(input: StartPracticeSessionInput): Promise<number>;
  recordAttempt(input: RecordPracticeAttemptInput): Promise<number>;
  completeSession(input: CompletePracticeSessionInput): Promise<void>;
}
