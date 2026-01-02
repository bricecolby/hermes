import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type MatchingAudioToTextJSON = PracticeItemJSON & {
  audioUrl: string;
  clips: { id: string; label?: string; conceptId?: number }[];
  options: { id: string; text: string }[];
  correctMatches: Record<string, string>; // clipId -> optionId
};

export class MatchingAudioToTextPracticeItem extends PracticeItem {
  private readonly audioUrl: string;
  private readonly clips: { id: string; label?: string; conceptId?: number }[];
  private readonly options: { id: string; text: string }[];
  private readonly correctMatches: Record<string, string>;

  constructor(json: MatchingAudioToTextJSON) {
    super({ type: json.type, mode: json.mode, skills: json.skills, conceptIds: json.conceptIds });
    this.audioUrl = String(json.audioUrl);
    this.clips = (json.clips ?? []) as any;
    this.options = (json.options ?? []) as any;
    this.correctMatches = (json.correctMatches ?? {}) as any;
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const submitted: Record<string, string> = ((userResponse as any)?.matches ?? {}) as any;

    const clipIds = this.clips.map((c) => c.id).filter(Boolean);
    const total = clipIds.length || 1;

    let correct = 0;

    const perClip = clipIds.map((clipId) => {
      const expected = this.correctMatches[clipId];
      const actual = submitted[clipId];
      const isCorrect = expected !== undefined && actual === expected;
      if (isCorrect) correct += 1;

      const conceptId = this.clips.find((c) => c.id === clipId)?.conceptId ?? this.conceptIds[0];

      return {
        conceptId,
        isCorrect,
        score: isCorrect ? 1 : 0,
        maxScore: 1,
        evidence: { clipId, expected, actual },
      };
    });

    const score = correct / total;

    const byConcept = new Map<number, { s: number; m: number; anyWrong: boolean; evid: any[] }>();
    for (const r of perClip) {
      const cur = byConcept.get(r.conceptId) ?? { s: 0, m: 0, anyWrong: false, evid: [] };
      cur.s += r.score;
      cur.m += r.maxScore;
      cur.anyWrong = cur.anyWrong || !r.isCorrect;
      cur.evid.push(r.evidence);
      byConcept.set(r.conceptId, cur);
    }

    const conceptResults = Array.from(byConcept.entries()).map(([conceptId, v]) => ({
      conceptId,
      score: v.s,
      maxScore: v.m,
      isCorrect: !v.anyWrong,
      evidence: v.evid,
    }));

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      score,
      isCorrect: score === 1,
      conceptResults,
      feedback: score === 1 ? "All matches correct." : "Some matches incorrect.",
      meta: { audioUrl: this.audioUrl },
    };
  }
}
