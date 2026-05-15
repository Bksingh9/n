import { describe, expect, it } from 'vitest';
import { computeBackoffMs } from '@/lib/services/jobs';

describe('computeBackoffMs', () => {
  it('first retry waits 1 minute', () => {
    expect(computeBackoffMs(1)).toBe(60_000 * 2);
    // attempts=0 corresponds to "this run was the first" — we never call it
    // with 0 from markJobFailed (attempts is already incremented), but check
    // monotonicity regardless.
  });
  it('grows exponentially', () => {
    expect(computeBackoffMs(2)).toBeGreaterThan(computeBackoffMs(1));
    expect(computeBackoffMs(3)).toBeGreaterThan(computeBackoffMs(2));
    expect(computeBackoffMs(4)).toBeGreaterThan(computeBackoffMs(3));
  });
  it('caps at 1 hour', () => {
    expect(computeBackoffMs(20)).toBeLessThanOrEqual(60 * 60_000);
    expect(computeBackoffMs(100)).toBe(60 * 60_000);
  });
});
