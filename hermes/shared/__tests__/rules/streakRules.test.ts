import {
  updateStreakOnCompletion,
  calculateMultiplier,
  STREAK_CONFIG,
  type StreakState,
} from "../../rules/streakRules";

function d(iso: string) {
  return new Date(iso);
}

describe("streakRules", () => {
  describe("updateStreakOnCompletion", () => {
    it("starts a streak at 1 on first-ever completion", () => {
      const prev: StreakState = { currentStreak: 0, lastCompletedDate: null };
      const now = d("2026-01-06T12:00:00Z");

      const res = updateStreakOnCompletion(prev, now);

      expect(res.streak).toBe(1);
      expect(res.updatedLastCompletedDate).toBe("2026-01-06");
      expect(res.multiplier).toBeCloseTo(calculateMultiplier(1));
    });

    it("does not increment streak if already completed today (idempotent)", () => {
      const prev: StreakState = { currentStreak: 3, lastCompletedDate: "2026-01-06" };
      const now = d("2026-01-06T23:59:59Z");

      const res = updateStreakOnCompletion(prev, now);

      expect(res.streak).toBe(3);
      expect(res.updatedLastCompletedDate).toBe("2026-01-06");
      expect(res.multiplier).toBeCloseTo(calculateMultiplier(3));
    });

    it("increments streak when completion is on the next calendar day", () => {
      const prev: StreakState = { currentStreak: 3, lastCompletedDate: "2026-01-06" };
      const now = d("2026-01-07T08:00:00Z");

      const res = updateStreakOnCompletion(prev, now);

      expect(res.streak).toBe(4);
      expect(res.updatedLastCompletedDate).toBe("2026-01-07");
      expect(res.multiplier).toBeCloseTo(calculateMultiplier(4));
    });

    it("resets streak to 1 after inactivity (missed one or more days)", () => {
      const prev: StreakState = { currentStreak: 5, lastCompletedDate: "2026-01-06" };
      const now = d("2026-01-08T08:00:00Z"); // skipped 2026-01-07

      const res = updateStreakOnCompletion(prev, now);

      expect(res.streak).toBe(1);
      expect(res.updatedLastCompletedDate).toBe("2026-01-08");
      expect(res.multiplier).toBeCloseTo(calculateMultiplier(1));
    });

    it("increments correctly across month boundaries", () => {
      const prev: StreakState = { currentStreak: 2, lastCompletedDate: "2026-01-31" };
      const now = d("2026-02-01T10:00:00Z");

      const res = updateStreakOnCompletion(prev, now);

      expect(res.streak).toBe(3);
      expect(res.updatedLastCompletedDate).toBe("2026-02-01");
    });

    it("increments correctly across year boundaries", () => {
      const prev: StreakState = { currentStreak: 7, lastCompletedDate: "2025-12-31" };
      const now = d("2026-01-01T10:00:00Z");

      const res = updateStreakOnCompletion(prev, now);

      expect(res.streak).toBe(8);
      expect(res.updatedLastCompletedDate).toBe("2026-01-01");
    });
  });

  describe("calculateMultiplier", () => {
    it("returns base multiplier for streak=1", () => {
      expect(calculateMultiplier(1)).toBeCloseTo(STREAK_CONFIG.baseMultiplier);
    });

    it("increases linearly by perDayBonus per additional streak day", () => {
      // streak=3 => base + (3-1)*bonus
      const expected =
        STREAK_CONFIG.baseMultiplier + 2 * STREAK_CONFIG.perDayBonus;
      expect(calculateMultiplier(3)).toBeCloseTo(expected);
    });

    it("caps multiplier at maxMultiplier", () => {
      // Pick a big streak that would exceed the cap
      const hugeStreak = 10_000;
      expect(calculateMultiplier(hugeStreak)).toBeCloseTo(STREAK_CONFIG.maxMultiplier);
    });
  });
});
