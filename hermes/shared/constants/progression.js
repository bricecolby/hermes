const LEVEL_TABLE = [
    { level: 1,    minXP: 0,     stamina: 100,   equipSlots: 1,   perkPointsAwarded: 0 },
    { level: 2,    minXP: 100,   stamina: 105,   equipSlots: 1,   perkPointsAwarded: 1 },
    { level: 3,    minXP: 300,   stamina: 110,   equipSlots: 2,   perkPointsAwarded: 1 },
    { level: 4,    minXP: 600,   stamina: 115,   equipSlots: 2,   perkPointsAwarded: 1 },
    { level: 5,    minXP: 1000,  stamina: 120,   equipSlots: 3,   perkPointsAwarded: 2 },
    { level: 6,    minXP: 1500,  stamina: 125,   equipSlots: 3,   perkPointsAwarded: 1 },
    { level: 7,    minXP: 2100,  stamina: 130,   equipSlots: 4,   perkPointsAwarded: 1 },
    { level: 8,    minXP: 2800,  stamina: 135,   equipSlots: 4,   perkPointsAwarded: 1 },
    { level: 9,    minXP: 3600,  stamina: 140,   equipSlots: 5,   perkPointsAwarded: 2 },
    { level: 10,   minXP: 4500,  stamina: 145,   equipSlots: 5,   perkPointsAwarded: 2 },
]

const BASE_STAMINA_REGEN_SECONDS = 180; // 1 stamina every 180 seconds (3 minutes)

module.exports = { LEVEL_TABLE, BASE_STAMINA_REGEN_SECONDS };