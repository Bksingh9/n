import { describe, expect, it } from 'vitest';
import { computeDeterministicScore } from '@/lib/matching/scoring';

const base = {
  id: 'a',
  age: 30,
  gender: 'woman',
  interested_in: 'men',
  relationship_goal: 'serious dating',
  preferred_age_min: 28,
  preferred_age_max: 38,
  hobbies: 'climbing, reading, jazz',
  conversation_topics: 'philosophy, travel, food',
};

describe('computeDeterministicScore', () => {
  it('returns 0 and conflict for self-pairing', () => {
    const r = computeDeterministicScore(base, base);
    expect(r.score).toBe(0);
    expect(r.preference_conflict).toBe(true);
  });

  it('flags age preference mismatch', () => {
    const a = { ...base };
    const b = { ...base, id: 'b', age: 22, gender: 'man', interested_in: 'women' };
    const r = computeDeterministicScore(a, b);
    expect(r.preference_conflict).toBe(true);
    expect(r.score).toBeLessThanOrEqual(35);
  });

  it('rewards mutual interest + shared hobbies', () => {
    const a = { ...base };
    const b = { ...base, id: 'b', gender: 'man', interested_in: 'women', age: 32, hobbies: 'climbing, jazz, baking' };
    const r = computeDeterministicScore(a, b);
    expect(r.preference_conflict).toBe(false);
    expect(r.score).toBeGreaterThan(60);
    expect(r.reasons.join(' ')).toMatch(/Shared interests|Mutual interest/);
  });

  it('flags orientation mismatch', () => {
    const a = { ...base };
    const b = { ...base, id: 'b', gender: 'woman', interested_in: 'men', age: 31 };
    const r = computeDeterministicScore(a, b);
    expect(r.preference_conflict).toBe(true);
  });

  it('handles missing data gracefully', () => {
    const a = { id: 'a', age: null, gender: null, interested_in: null, relationship_goal: null, preferred_age_min: null, preferred_age_max: null, hobbies: null, conversation_topics: null };
    const b = { ...a, id: 'b' };
    const r = computeDeterministicScore(a, b);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
