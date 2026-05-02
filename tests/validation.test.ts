import { describe, expect, it } from 'vitest';
import { ApplicationSchema } from '@/lib/services/attendees';
import { CreateEventSchema } from '@/lib/services/events';
import { InterestSchema } from '@/lib/services/postevent';

describe('ApplicationSchema', () => {
  it('accepts a valid application', () => {
    const r = ApplicationSchema.safeParse({
      first_name: 'A', last_name: 'B', email: 'a@b.co', age: 30, consent_to_contact: 'on',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.consent_to_contact).toBe(true);
  });
  it('rejects under-18', () => {
    const r = ApplicationSchema.safeParse({ first_name: 'A', last_name: 'B', email: 'a@b.co', age: 17 });
    expect(r.success).toBe(false);
  });
  it('rejects bad email', () => {
    const r = ApplicationSchema.safeParse({ first_name: 'A', last_name: 'B', email: 'not-email', age: 25 });
    expect(r.success).toBe(false);
  });
});

describe('CreateEventSchema', () => {
  it('accepts well-formed event', () => {
    const r = CreateEventSchema.safeParse({
      title: 'Speed dating', starts_at: '2030-01-01T18:00', ends_at: '2030-01-01T20:00', age_min: 25,
    });
    expect(r.success).toBe(true);
  });
  it('rejects empty title', () => {
    const r = CreateEventSchema.safeParse({ title: '', starts_at: '2030-01-01T18:00', ends_at: '2030-01-01T20:00' });
    expect(r.success).toBe(false);
  });
});

describe('InterestSchema', () => {
  it('accepts valid interest with consent', () => {
    const r = InterestSchema.safeParse({
      to_attendee_id: '11111111-1111-1111-1111-111111111111',
      interest_type: 'romantic',
      consent_to_share_contact: 'on',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.consent_to_share_contact).toBe(true);
  });
  it('defaults consent to false when omitted', () => {
    const r = InterestSchema.safeParse({
      to_attendee_id: '11111111-1111-1111-1111-111111111111',
      interest_type: 'friendship',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.consent_to_share_contact).toBe(false);
  });
  it('rejects unknown interest type', () => {
    const r = InterestSchema.safeParse({
      to_attendee_id: '11111111-1111-1111-1111-111111111111',
      interest_type: 'enemies',
    });
    expect(r.success).toBe(false);
  });
});
