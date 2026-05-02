import { describe, expect, it } from 'vitest';
import { PLANS } from '@/lib/plans';

// Pure plan-config sanity tests. Server-side enforcement is tested in
// integration tests (not bundled with unit suite to avoid Supabase deps).
describe('PLANS', () => {
  it('free plan blocks AI matching', () => {
    expect(PLANS.free.limits.ai_matching_runs).toBe(0);
  });
  it('paid plans escalate event quota', () => {
    expect(PLANS.starter.limits.events_created).toBeLessThan(PLANS.pro.limits.events_created);
    expect(PLANS.pro.limits.events_created).toBeLessThan(PLANS.agency.limits.events_created);
  });
  it('paid plans escalate attendee quota', () => {
    expect(PLANS.free.limits.attendees_registered).toBeLessThan(PLANS.starter.limits.attendees_registered);
    expect(PLANS.starter.limits.attendees_registered).toBeLessThan(PLANS.pro.limits.attendees_registered);
    expect(PLANS.pro.limits.attendees_registered).toBeLessThan(PLANS.agency.limits.attendees_registered);
  });
});

// Smoke test: limit comparison is the single source of truth.
describe('limit math', () => {
  it('used + amount > limit means not allowed', () => {
    const limit = PLANS.free.limits.events_created;
    const used = limit;
    const allowed = used + 1 <= limit;
    expect(allowed).toBe(false);
  });
});
