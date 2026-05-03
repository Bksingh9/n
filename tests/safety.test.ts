import { describe, expect, it } from 'vitest';
import { SafetyCategories, SafetyReportSchema } from '@/lib/services/safety';

describe('SafetyReportSchema', () => {
  it('accepts a well-formed report', () => {
    const r = SafetyReportSchema.safeParse({
      category: 'harassment',
      details: 'Made me feel unsafe.',
      reported_attendee_id: '11111111-1111-1111-1111-111111111111',
    });
    expect(r.success).toBe(true);
  });
  it('accepts report without a specific attendee', () => {
    const r = SafetyReportSchema.safeParse({
      category: 'venue_concern',
      details: 'Stairs were not safe.',
      reported_attendee_id: '',
    });
    expect(r.success).toBe(true);
  });
  it('requires details', () => {
    expect(
      SafetyReportSchema.safeParse({ category: 'other', details: '' }).success,
    ).toBe(false);
  });
  it('rejects unknown categories', () => {
    expect(
      SafetyReportSchema.safeParse({ category: 'foo', details: 'x' }).success,
    ).toBe(false);
  });
  it('rejects malformed attendee id', () => {
    expect(
      SafetyReportSchema.safeParse({
        category: 'harassment',
        details: 'x',
        reported_attendee_id: 'not-a-uuid',
      }).success,
    ).toBe(false);
  });
});

describe('SafetyCategories', () => {
  it('exposes a stable list of categories', () => {
    expect(SafetyCategories).toContain('harassment');
    expect(SafetyCategories).toContain('venue_concern');
    expect(SafetyCategories.length).toBeGreaterThanOrEqual(4);
  });
});
