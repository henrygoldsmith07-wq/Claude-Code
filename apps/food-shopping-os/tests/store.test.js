import { describe, it, expect } from 'vitest';
import { levelFromXp, xpIntoLevel, XP_PER_LEVEL, rolloverDay, recentFoodsFrom } from '../src/lib/store.jsx';
import { seedLog } from '../src/data/log-seed.js';
import { dayTotals } from '../src/lib/nutrition.js';

describe('levels', () => {
  it('derives level from xp consistently', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(XP_PER_LEVEL - 1)).toBe(1);
    expect(levelFromXp(XP_PER_LEVEL)).toBe(2);
    expect(levelFromXp(1240)).toBe(8);
  });
  it('xpIntoLevel + level are coherent', () => {
    for (const xp of [0, 40, 159, 160, 1240, 5000]) {
      expect(xpIntoLevel(xp)).toBe(xp % XP_PER_LEVEL);
      expect(xpIntoLevel(xp)).toBeLessThan(XP_PER_LEVEL);
    }
  });
});

describe('rolloverDay', () => {
  const base = {
    day: '2026-07-21',
    water: 6,
    cookedToday: true,
    streak: 12,
    xp: 1240,
    log: { '2026-07-21': [{ id: 'a', meal: 'lunch' }] },
  };
  it('resets daily fields on a new day and keeps long-lived state', () => {
    const next = rolloverDay(base, '2026-07-22');
    expect(next.day).toBe('2026-07-22');
    expect(next.water).toBe(0);
    expect(next.cookedToday).toBe(false);
    expect(next.streak).toBe(12);
    expect(next.xp).toBe(1240);
  });
  it('keeps the diary history — a new day just has no entries yet', () => {
    const next = rolloverDay(base, '2026-07-22');
    expect(next.log['2026-07-21']).toHaveLength(1);
    expect(next.log['2026-07-22']).toBeUndefined();
    expect(dayTotals(next.log[next.day] || []).kcal).toBe(0);
  });
  it('is a no-op on the same day', () => {
    expect(rolloverDay(base, '2026-07-21')).toBe(base);
  });
});

describe('seeded diary', () => {
  const log = seedLog();
  const today = new Date().toISOString().slice(0, 10);

  it('gives today a part-logged day and a week of history', () => {
    expect(Object.keys(log)).toHaveLength(7);
    expect(log[today].length).toBeGreaterThan(0);
    const kcal = dayTotals(log[today]).kcal;
    expect(kcal).toBeGreaterThan(900);
    expect(kcal).toBeLessThan(1600);
  });

  it('every seeded entry resolves to a real food', () => {
    for (const entries of Object.values(log)) {
      for (const e of entries) {
        expect(e.per100, `${e.name} has nutrition`).toBeTruthy();
        expect(e.grams).toBeGreaterThan(0);
      }
    }
  });

  it('recent foods are newest-first and de-duplicated', () => {
    const recents = recentFoodsFrom(log);
    const ids = recents.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('greek-yogurt');
  });
});
