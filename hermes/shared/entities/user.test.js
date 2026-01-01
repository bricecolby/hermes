const User = require('./user'); 

describe('User (progression + stamina)', () => {
  test('constructs from minimal required fields', () => {
    const u = new User({
      username: 'brice',
      learning_lang_id: 1,
      native_lang_id: 2,
      xp: 0,
      stamina: 0,
      stamina_updated_at: new Date(0).toISOString(),
    });

    expect(u.getUsername()).toBe('brice');
    expect(u.getLevel()).toBe(1);
    expect(u.getXP()).toBe(0);
  });

  test('addXP increases XP and updates level', () => {
    const u = new User({
      username: 'brice',
      learning_lang_id: 1,
      native_lang_id: 2,
      xp: 90,
      stamina: 50,
      stamina_updated_at: new Date(0).toISOString(),
    });

    u.addXP(20);

    expect(u.getXP()).toBe(110);
    expect(u.getLevel()).toBeGreaterThanOrEqual(2);
  });

  test('level-up adds overflow stamina equal to new max stamina', () => {
    // Start just below level 2 threshold (per your table: level 2 at 100 XP)
    const u = new User({
      username: 'brice',
      learning_lang_id: 1,
      native_lang_id: 2,
      xp: 90,
      stamina: 50,
      stamina_updated_at: new Date(0).toISOString(),
    });

    u.addXP(20); // should hit level 2

    // Level 2 max stamina is 105 in your table, so 50 + 105 = 155 expected
    expect(u.getLevel()).toBe(2);
    expect(u.getStamina()).toBe(155);
  });

  test('regenStamina preserves remainder time (5 minutes -> +1 stamina, not +2)', () => {
    const start = new Date('2020-01-01T00:00:00.000Z');
    const fiveMinutesLater = new Date(start.getTime() + 5 * 60 * 1000);

    const u = new User({
      username: 'brice',
      learning_lang_id: 1,
      native_lang_id: 2,
      xp: 0,
      stamina: 0,
      stamina_updated_at: start.toISOString(),
    });

    u.regenStamina(fiveMinutesLater.getTime());

    // 1 stamina per 180s: 5 min = 300s => +1 stamina, remainder 120s
    expect(u.getStamina()).toBe(1);

    // Next tick should be in ~60 seconds (180 - 120)
    const secondsLeft = u.getSecondsUntilNextStamina(fiveMinutesLater.getTime());
    expect(secondsLeft).toBeGreaterThan(0);
    expect(secondsLeft).toBeLessThanOrEqual(60);
  });

  test('spendStamina returns false if insufficient', () => {
    const now = Date.now();
    const u = new User({
      username: 'brice',
      learning_lang_id: 1,
      native_lang_id: 2,
      xp: 0,
      stamina: 0,
      stamina_updated_at: new Date(now).toISOString(),
    });

    expect(u.spendStamina(1, now)).toBe(false);
  });

  test('spendStamina subtracts stamina and starts timer if dropping below max', () => {
    const now = Date.now();

    const u = new User({
      username: 'brice',
      learning_lang_id: 1,
      native_lang_id: 2,
      xp: 0,
      stamina: 100, // max at level 1 is 100
      stamina_updated_at: new Date(0).toISOString(),
    });

    expect(u.spendStamina(1, now)).toBe(true);
    expect(u.getStamina()).toBe(99);
    expect(u.getStaminaUpdatedAt()).toBe(new Date(now).toISOString());
  });
});
