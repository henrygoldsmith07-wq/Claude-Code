import { describe, it, expect } from 'vitest';
import { levelFromXp, xpIntoLevel, XP_PER_LEVEL, rolloverDay } from '../src/lib/store.jsx';

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
    kcalToday: 1900,
    proteinToday: 90,
    carbsToday: 200,
    fatToday: 60,
    cookedToday: true,
    streak: 12,
    xp: 1240,
  };
  it('resets daily fields on a new day and keeps long-lived state', () => {
    const next = rolloverDay(base, '2026-07-22');
    expect(next.day).toBe('2026-07-22');
    expect(next.water).toBe(0);
    expect(next.kcalToday).toBe(0);
    expect(next.proteinToday).toBe(0);
    expect(next.cookedToday).toBe(false);
    expect(next.streak).toBe(12);
    expect(next.xp).toBe(1240);
  });
  it('is a no-op on the same day', () => {
    expect(rolloverDay(base, '2026-07-21')).toBe(base);
  });
});
