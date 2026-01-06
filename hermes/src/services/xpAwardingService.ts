import { updateStreakOnCompletion } from "../../shared/rules/streakRules";
import { calculateAwardedXp } from "../../shared/rules/xpRules";
import { applyXpToProgression } from "../../shared/rules/progressionRules";

export type UserStatsSnapshot = {
  totalXp: number;
  level: number;
  currentStreak: number;
  lastCompletedDate: string | null; // YYYY-MM-DD
};

export type AwardXpInput = {
  stats: UserStatsSnapshot;
  baseXp: number;
  now?: Date;
};

export type AwardXpOutput = {
  awardedXp: number;
  nextStats: UserStatsSnapshot;
  streakMultiplier: number;
};

export function awardXpForCompletion(input: AwardXpInput): AwardXpOutput {
  const now = input.now ?? new Date();

  const streakRes = updateStreakOnCompletion(
    {
      currentStreak: input.stats.currentStreak,
      lastCompletedDate: input.stats.lastCompletedDate,
    },
    now
  );

  const xpRes = calculateAwardedXp({
    baseXp: input.baseXp,
    streakMultiplier: streakRes.multiplier,
  });

  const prog = applyXpToProgression({
    totalXp: input.stats.totalXp,
    level: input.stats.level,
    xpGained: xpRes.awardedXp,
  });

  return {
    awardedXp: xpRes.awardedXp,
    streakMultiplier: streakRes.multiplier,
    nextStats: {
      totalXp: prog.totalXp,
      level: prog.level,
      currentStreak: streakRes.streak,
      lastCompletedDate: streakRes.updatedLastCompletedDate,
    },
  };
}
