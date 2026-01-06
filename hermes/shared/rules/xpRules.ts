export type XpContext = {
    baseXp: number;
    streakMultiplier?: number;
    difficultyMultiplier?: number;
    qualityMulitplier?: number; 
};

export type XpResult = {
    baseXp: number;
    multiplier: number;
    awardedXp: number;
    breakdown: {
        streak: number;
        difficulty: number;
        quality: number;
    };
}

const DEFAULTS = {
    streakMultiplier: 1,
    difficultyMultiplier: 1,
    qualityMultiplier: 1,
};

export function calculateAwardedXp(ctx: XpContext): XpResult {
    const streak = ctx.streakMultiplier ?? DEFAULTS.streakMultiplier;
    const difficulty = ctx.difficultyMultiplier ?? DEFAULTS.difficultyMultiplier;
    const quality = ctx.qualityMulitplier ?? DEFAULTS.qualityMultiplier;

    const totalMultiplier = streak * difficulty * quality;
    const awardedXp = Math.round(ctx.baseXp * totalMultiplier);

    return {
        baseXp: ctx.baseXp,
        multiplier: totalMultiplier,
        awardedXp,
        breakdown: {
            streak,
            difficulty,
            quality,
        },
    };
}