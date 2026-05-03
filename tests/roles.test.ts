import { describe, expect, it } from 'vitest';
import { isAtLeast, planFeatures } from '@/lib/roles';

describe('isAtLeast', () => {
  it('owner satisfies admin and member', () => {
    expect(isAtLeast('owner', 'admin')).toBe(true);
    expect(isAtLeast('owner', 'member')).toBe(true);
  });
  it('admin does not satisfy owner', () => {
    expect(isAtLeast('admin', 'owner')).toBe(false);
  });
  it('member does not satisfy admin', () => {
    expect(isAtLeast('member', 'admin')).toBe(false);
  });
  it('unknown role fails any minimum', () => {
    expect(isAtLeast('guest', 'member')).toBe(false);
  });
});

describe('planFeatures', () => {
  it('locks white-label to agency', () => {
    expect(planFeatures('free').whiteLabel).toBe(false);
    expect(planFeatures('starter').whiteLabel).toBe(false);
    expect(planFeatures('pro').whiteLabel).toBe(false);
    expect(planFeatures('agency').whiteLabel).toBe(true);
  });
  it('opens CSV on pro and agency', () => {
    expect(planFeatures('starter').csvExport).toBe(false);
    expect(planFeatures('pro').csvExport).toBe(true);
    expect(planFeatures('agency').csvExport).toBe(true);
  });
  it('opens team invites on pro and agency', () => {
    expect(planFeatures('free').teamInvites).toBe(false);
    expect(planFeatures('starter').teamInvites).toBe(false);
    expect(planFeatures('pro').teamInvites).toBe(true);
    expect(planFeatures('agency').teamInvites).toBe(true);
  });
});
