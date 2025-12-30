const { BASE_STAMINA_REGEN_RATE } = require('../constants/progression');
// const { getPerkById } = require('../constants/perks');

function getRegenSecondsForUser({ equippedPerkIds = [] } = {}) {
    let regenSeconds = BASE_STAMINA_REGEN_RATE;

    for (const perkId of equippedPerkIds) {
        // const perk = getPerkById(perkId);
        // if (perk && perk.staminaRegenModifier) {
        //     regenSeconds *= perk.staminaRegenModifier;
        // }
    }

    return regenSeconds;
}

module.exports = { getRegenSecondsForUser };