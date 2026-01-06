export type StreakState = {
    currentStreak: number;
    lastCompletedDate: string | null; // ISO date string 
};

export type StreakUpdateResult = {
    streak: number;
    multiplier: number;
    updatedLastCompletedDate: string;
}

export const STREAK_CONFIG = {
    baseMultiplier: 1,
    perDayBonus: 0.1,
    maxMultiplier: 2.0,
};

function toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function isNextDay(dateA: Date, dateB: Date): boolean {
    const a = new Date(dateA);
    a.setDate(a.getDate() + 1);
    return toDateKey(a) === toDateKey(dateB);
}

export function updateStreakOnCompletion(
    prev: StreakState,
    now: Date = new Date()
): StreakUpdateResult {
    const todayKey = toDateKey(now);

    if (!prev.lastCompletedDate) {
        return {
            streak: 1,
            multiplier: calculateMultiplier(1),
            updatedLastCompletedDate: todayKey,
        };
    }

    const lastDate = new Date(prev.lastCompletedDate);

    if (toDateKey(lastDate) === todayKey) {
        return {
            streak: prev.currentStreak,
            multiplier: calculateMultiplier(prev.currentStreak),
            updatedLastCompletedDate: prev.lastCompletedDate,
        };
    }

    if (isNextDay(lastDate, now)) {
        const nextStreak = prev.currentStreak + 1;
        return {
            streak: nextStreak,
            multiplier: calculateMultiplier(nextStreak),
            updatedLastCompletedDate: todayKey,
        };
    }

    return {
        streak: 1,
        multiplier: calculateMultiplier(1),
        updatedLastCompletedDate: todayKey,
    }
}

export function calculateMultiplier(streak: number): number {
    const raw = STREAK_CONFIG.baseMultiplier + (streak - 1) * STREAK_CONFIG.perDayBonus;
    return Math.min(raw, STREAK_CONFIG.maxMultiplier);
}