import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders, computeWindowStart } from '@/lib/rate-limit';

describe('computeWindowStart', () => {
  it('truncates to the start of the window', () => {
    const now = new Date('2030-01-01T12:34:56.789Z');
    const start = computeWindowStart(now, 60 * 60_000);
    expect(start.toISOString()).toBe('2030-01-01T12:00:00.000Z');
  });
  it('produces the same window for any moment within it', () => {
    const a = computeWindowStart(new Date('2030-01-01T12:00:00Z'), 5 * 60_000);
    const b = computeWindowStart(new Date('2030-01-01T12:04:59.999Z'), 5 * 60_000);
    expect(a.toISOString()).toBe(b.toISOString());
  });
  it('produces a new window when the boundary is crossed', () => {
    const a = computeWindowStart(new Date('2030-01-01T12:04:59Z'), 5 * 60_000);
    const b = computeWindowStart(new Date('2030-01-01T12:05:00Z'), 5 * 60_000);
    expect(a.toISOString()).not.toBe(b.toISOString());
  });
});

const headers = (init: Record<string, string>): Headers => {
  const h = new Headers();
  for (const [k, v] of Object.entries(init)) h.set(k, v);
  return h;
};

describe('clientIpFromHeaders', () => {
  it('uses the first hop of x-forwarded-for', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });
  it('falls back to x-real-ip', () => {
    expect(clientIpFromHeaders(headers({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
  });
  it('falls back to cf-connecting-ip', () => {
    expect(clientIpFromHeaders(headers({ 'cf-connecting-ip': '10.0.0.1' }))).toBe('10.0.0.1');
  });
  it("returns 'anon' when no header is set", () => {
    expect(clientIpFromHeaders(headers({}))).toBe('anon');
  });
  it('prefers x-forwarded-for over the others', () => {
    expect(
      clientIpFromHeaders(headers({ 'x-forwarded-for': '1.1.1.1', 'x-real-ip': '2.2.2.2' })),
    ).toBe('1.1.1.1');
  });
});
