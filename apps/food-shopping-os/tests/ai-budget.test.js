import { afterEach, describe, expect, it } from 'vitest';
import { monthlyAiLimit, tokenReservation } from '../src/server/ai-budget.js';

describe('AI household budget', () => {
  afterEach(() => { delete process.env.AI_MONTHLY_TOKEN_LIMIT; });

  it('has a hard monthly default and honours a configured ceiling', () => {
    expect(monthlyAiLimit()).toBe(250000);
    process.env.AI_MONTHLY_TOKEN_LIMIT = '50000';
    expect(monthlyAiLimit()).toBe(50000);
    expect(tokenReservation({ prompt: 'hello' }, 1200)).toBeLessThanOrEqual(50000);
  });
});
