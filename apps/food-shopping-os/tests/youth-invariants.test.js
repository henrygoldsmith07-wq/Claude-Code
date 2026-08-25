import { describe, it, expect } from 'vitest';
import { hydrate, parseBackup } from '../src/lib/store-persistence.js';
import { youthPolicy } from '../src/lib/youth.js';

describe('youth invariants — impossible to bypass via any entry point', () => {
  const ADVERSARIAL_STATES = [
    { name: 'backup restore', input: { body: { age: 15 }, goal: 'lose-weight', weeklyKcal: -500 } },
    { name: 'cloud sync pull', input: { body: { age: 12 }, goal: 'lose-weight', targetMode: 'custom', weeklyKcal: -300 } },
    { name: 'household child profile', input: { body: { age: null }, members: [{ id: 'c1', role: 'child' }], activeMemberId: 'c1', goal: 'lose-weight' } },
  ];

  for (const { name, input } of ADVERSARIAL_STATES) {
    it(`${name}: deficits stripped, goals forced to maintenance`, () => {
      const state = hydrate(input);
      expect(state.goal).toBe('maintain');
      expect(state.weeklyKcal).toBe(0);
      expect(youthPolicy(state).on).toBe(true);
    });
  }

  it('adult state passes through without youth restrictions', () => {
    const state = hydrate({ body: { age: 30 }, goal: 'lose-weight', weeklyKcal: -300 });
    expect(state.goal).toBe('lose-weight'); // adults keep their chosen goal
  });

  it('backup restore cannot smuggle a deficit past hydration', () => {
    const backup = JSON.stringify({
      format: 'forq-backup', version: 4,
      exportedAt: '2026-01-01',
      state: { onboarded: true, body: { age: 14 }, goal: 'lose-weight', weeklyKcal: -200 },
    });
    const state = parseBackup(backup);
    expect(state.goal).toBe('maintain');
    expect(state.weeklyKcal).toBe(0);
  });

  it('fasting data is stripped for under-18s regardless of entry point', () => {
    const state = hydrate({ body: { age: 13 }, fastPlan: '16-8' });
    expect(state.fastPlan).toBeUndefined();
  });
});
