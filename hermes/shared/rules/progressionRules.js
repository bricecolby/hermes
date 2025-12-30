const { get } = require('http');
const { LEVEL_TABLE, BASE_STAMINA_REGEN_SECONDS } = require('../constants/progression');

function computeLevelFromXP(xp) {
    if (!Number.isFinite(xp) || xp < 0) throw new Error(`XP must be a non-negative number: ${xp}`);

    let level = 1;
    for (const row of LEVEL_TABLE) {
        if (xp >= row.minXP) {
            level = row.level;
        } else {
            break;
        }
    }

    return level;
}

function getRowForLevel(level) {
    if (!Number.isInteger(level) || level < 1) throw new Error(`Level must be a positive integer: ${level}`);

    let row = LEVEL_TABLE[0];
    for (const r of LEVEL_TABLE) {
        if (level >= r.level) row = r;
        else break;
    }

    return row;
}

function computePerkPointGains(oldLevel, newLevel) {
    if (newLevel <= oldLevel) return 0;

    let gained = 0;
    for (const r of LEVEL_TABLE) {
        if (r.level > oldLevel && r.level <= newLevel) {
            gained += r.perkPointsAwarded;
        }
    }

    return gained;
}

function getMaxStaminaForLevel(level) {
    const row = getRowForLevel(level);
    return row.stamina;
}

module.exports = {
    computeLevelFromXP,
    getRowForLevel,
    computePerkPointGains,
    getMaxStaminaForLevel,
    BASE_STAMINA_REGEN_SECONDS,
};