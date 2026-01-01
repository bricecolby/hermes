const {
    computeLevelFromXP,
    getRowForLevel,
    computePerkPointGains,
    getMaxStaminaForLevel,
    BASE_STAMINA_REGEN_SECONDS,
} = require('../rules/progressionRules');

class User {
    #id;
    #username;
    #learningLangId;
    #nativeLangId;

    #xp;
    #level;
    #stamina;
    #staminaUpdatedAt;

    #perkPoints;
    #equipSlots;

    #streakCount;
    #lastLogin;

    constructor({
        id = null,
        username,
        learning_lang_id,
        native_lang_id,

        xp = 0,
        perk_points = 0,
        equip_slots = 1,
        stamina = 0,
        stamina_updated_at = new Date().toISOString(),

        streak_count = 0,
        last_login = null,
    } = {}) {
        if (!username || typeof username !== 'string' || username.trim() === '') throw new Error('Invalid username');
        if (!Number.isInteger(learning_lang_id) || learning_lang_id <= 0) throw new Error('Invalid learning language ID');
        if (!Number.isInteger(native_lang_id) || native_lang_id <= 0) throw new Error('Invalid native language ID');
        if (!Number.isFinite(xp) || xp < 0) throw new Error('Invalid XP value');
        if (!Number.isInteger(stamina) || stamina < 0) throw new Error('Invalid stamina value');
        if (!Number.isInteger(perk_points) || perk_points < 0) throw new Error('Invalid perk points value');
        if (!Number.isInteger(equip_slots) || equip_slots <= 0) throw new Error('Invalid equip slots value');

        const computedLevel = computeLevelFromXP(xp);
        const row = getRowForLevel(computedLevel);

        this.#id = id;
        this.#username = username;
        this.#learningLangId = learning_lang_id;
        this.#nativeLangId = native_lang_id;

        this.#xp = xp;
        this.#level = computedLevel;

        this.#stamina = stamina
        this.#staminaUpdatedAt = stamina_updated_at;

        this.#perkPoints = perk_points;
        this.#equipSlots = Math.max(equip_slots, row.equipSlots);
        
        this.#streakCount = streak_count;
        this.#lastLogin = last_login;
    }

    // --------- XP / LEVEL ---------
    addXP(amount) {
        if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid amount ${amount} to add to XP`);
        
        const oldLevel = this.#level;
        this.#xp += amount;
        
        const newLevel = computeLevelFromXP(this.#xp);

        if (newLevel > oldLevel) {
            this.#level = newLevel;
            this.#perkPoints += computePerkPointGains(oldLevel, newLevel);

            const row = getRowForLevel(newLevel);
            this.#equipSlots = Math.max(this.#equipSlots, row.equipSlots);

            this.#stamina += getMaxStaminaForLevel(newLevel);
            this.#staminaUpdatedAt = new Date().toISOString();
        }
    }
    
    // --------- STAMINA ---------
    getMaxStamina() {
        return getMaxStaminaForLevel(this.#level);
    }

    regenStamina(now = Date.now()) {
        const max = this.getMaxStamina();
        if (this.#stamina >= max) return;

        const last = Date.parse(this.#staminaUpdatedAt);
        const nowMs = typeof now === 'number' ? now : Date.parse(now);

        const intervalMs = BASE_STAMINA_REGEN_SECONDS * 1000;
        const elapsedMs = nowMs - last;
        
        if (elapsedMs < intervalMs) return;

        const gained = Math.floor(elapsedMs / intervalMs);
        if (gained <= 0) return;

        const newStamina = Math.min(this.#stamina + gained, max);
        const actuallyGained = newStamina - this.#stamina;

        this.#stamina = newStamina;

        const advancedMs = last + actuallyGained * intervalMs;
        this.#staminaUpdatedAt = new Date(advancedMs).toISOString();
    }

    getSecondsUntilNextStamina(now = Date.now()) {
        const max = this.getMaxStamina();
        if (this.#stamina >= max) return 0;

        const last = Date.parse(this.#staminaUpdatedAt);
        const nowMs = typeof now === 'number' ? now : Date.parse(now);

        const intervalMs = BASE_STAMINA_REGEN_SECONDS * 1000;
        const elapsedMs = nowMs - last;

        const remainderMs = elapsedMs % intervalMs;
        const leftMs = intervalMs - remainderMs;
        return Math.max(0, Math.ceil(leftMs / 1000));
    }

    spendStamina(cost, now = Date.now()) {
        if (!Number.isInteger(cost) || cost <= 0) throw new Error(`Invalid stamina cost: ${cost}`);

        this.regenStamina(now);

        if (this.#stamina < cost) return false;

        const maxStamina = this.getMaxStamina();
        const wasFull = this.#stamina >= maxStamina;

        this.#stamina -= cost;

        if (wasFull && this.#stamina < maxStamina) {
            this.#staminaUpdatedAt = new Date(now).toISOString();
        }
        return true;
    }

    // --------- Getters ---------
    getId() { return this.#id; }
    getUsername() { return this.#username; }
    getLearningLangId() { return this.#learningLangId; }
    getNativeLangId() { return this.#nativeLangId; }

    getXP() { return this.#xp; }
    getLevel() { return this.#level; }
    getStamina() { return this.#stamina; }
    getStaminaUpdatedAt() { return this.#staminaUpdatedAt; }

    getPerkPoints() { return this.#perkPoints; }
    getEquipSlots() { return this.#equipSlots; }

    getStreakCount() { return this.#streakCount; }
    getLastLogin() { return this.#lastLogin; }

    toRecord() {
        return {
            id: this.#id,
            username: this.#username,
            learning_lang_id: this.#learningLangId,
            native_lang_id: this.#nativeLangId,

            xp: this.#xp,
            level: this.#level,
            stamina: this.#stamina,
            stamina_updated_at: this.#staminaUpdatedAt,

            perk_points: this.#perkPoints,
            equip_slots: this.#equipSlots,

            streak_count: this.#streakCount,
            last_login: this.#lastLogin,
        };
    }

    static fromRecord(row) {
        return new User(row);
    }
}

module.exports = User;