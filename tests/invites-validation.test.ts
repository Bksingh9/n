import { describe, expect, it } from 'vitest';
import { InviteSchema } from '@/lib/services/invites';
import { BrandSchema } from '@/lib/services/brands';

describe('InviteSchema', () => {
  it('accepts valid admin invite', () => {
    expect(InviteSchema.safeParse({ email: 'a@b.co', role: 'admin' }).success).toBe(true);
  });
  it('rejects unknown roles', () => {
    expect(InviteSchema.safeParse({ email: 'a@b.co', role: 'owner' }).success).toBe(false);
    expect(InviteSchema.safeParse({ email: 'a@b.co', role: 'visitor' }).success).toBe(false);
  });
  it('rejects bad emails', () => {
    expect(InviteSchema.safeParse({ email: 'no-at', role: 'admin' }).success).toBe(false);
  });
});

describe('BrandSchema', () => {
  it('accepts valid hex color with or without leading #', () => {
    expect(BrandSchema.safeParse({ name: 'Brand', primary_color: 'e11d48' }).success).toBe(true);
    expect(BrandSchema.safeParse({ name: 'Brand', primary_color: '#e11d48' }).success).toBe(true);
  });
  it('rejects malformed hex', () => {
    expect(BrandSchema.safeParse({ name: 'Brand', primary_color: 'red' }).success).toBe(false);
    expect(BrandSchema.safeParse({ name: 'Brand', primary_color: '#xyz' }).success).toBe(false);
  });
  it('coerces is_default checkbox value to boolean', () => {
    const r = BrandSchema.safeParse({ name: 'Brand', is_default: 'on' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.is_default).toBe(true);
  });
});
