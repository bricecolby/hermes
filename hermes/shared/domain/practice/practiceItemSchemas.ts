// shared/domain/practice/practiceItemSchemas.ts
import { z } from "zod";

export const PracticeModeSchema = z.enum([
  "reception",
  "production",
  "interaction",
  "mediation",
]);

export const PracticeSkillSchema = z.enum([
  "reading",
  "listening",
  "writing",
  "speaking",
]);

export const PracticeItemBaseSchema = z.object({
  type: z.string().min(1),
  mode: PracticeModeSchema,
  skills: z.array(PracticeSkillSchema).min(1),
  conceptIds: z.array(z.number().finite()).min(1),
});

export type PracticeItemBaseJSON = z.infer<typeof PracticeItemBaseSchema>;
export type PracticeSkill = z.infer<typeof PracticeSkillSchema>;
export type PracticeMode = z.infer<typeof PracticeModeSchema>;
