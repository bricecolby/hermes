import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type MediationSummarizeTextJSON = PracticeItemJSON & {
  sourceText: string;
  keyPoints?: { text: string; conceptId?: number }[];
  minWords?: number;
  maxWords?: number;
};

export class MediationSummarizeTextPracticeItem extends PracticeItem {
  private readonly sourceText: string;
  private readonly keyPoints: { text: string; conceptId?: number }[];
  private readonly minWords: number;
  private readonly maxWords: number;

  constructor(json: MediationSummarizeTextJSON) {
    super({ type: json.type, mode: json.mode, skills: json.skills, conceptIds: json.conceptIds });
    this.sourceText = String(json.sourceText);
    this.keyPoints = (json.keyPoints ?? []) as any;
    this.minWords = Number.isFinite(json.minWords as any) ? Number(json.minWords) : 5;
    this.maxWords = Number.isFinite(json.maxWords as any) ? Number(json.maxWords) : 60;
  }

  private norm(s: string): string {
    return s.trim().toLowerCase();
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const summary = String((userResponse as any)?.text ?? "");
    const words = summary.trim().split(/\s+/).filter(Boolean);
    const wc = words.length;

    const withinBounds = wc >= this.minWords && wc <= this.maxWords;

    const kp = this.keyPoints
      .map((k) => ({ ...k, n: this.norm(k.text) }))
      .filter((k) => k.n.length > 0);

    const summaryNorm = this.norm(summary);
    const hits = kp.filter((k) => summaryNorm.includes(k.n)).length;

    let score = 0;
    if (wc === 0) score = 0;
    else if (kp.length === 0) score = withinBounds ? 0.8 : 0.6;
    else {
      const coverage = hits / kp.length;
      score = 0.2 + 0.6 * coverage + (withinBounds ? 0.2 : 0);
      score = Math.max(0, Math.min(1, score));
    }

    const conceptResults: EvaluationResult["conceptResults"] = [];

    if (kp.length > 0) {
      for (const k of kp) {
        const hit = summaryNorm.includes(k.n);
        const conceptId = k.conceptId ?? this.conceptIds[0];
        conceptResults.push({
          conceptId,
          score: hit ? 1 : 0,
          maxScore: 1,
          isCorrect: hit,
          evidence: { keyPoint: k.n },
        });
      }
    } else {
      for (const conceptId of this.conceptIds) {
        conceptResults.push({
          conceptId,
          score,
          maxScore: 1,
          evidence: { wordCount: wc, withinBounds },
        });
      }
    }

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      score,
      isCorrect: score === 1,
      conceptResults,
      feedback: "Summary scoring is heuristic in MVP (keyword coverage + length bounds).",
      meta: { wordCount: wc, withinBounds, keyPointHits: hits, keyPointTotal: kp.length },
    };
  }
}
