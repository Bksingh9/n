import { describe, expect, it } from 'vitest';
import { initialOnly, redactAttendeeForAi, redactPii } from '@/lib/pii';

describe('redactPii', () => {
  it('returns empty for empty input', () => {
    expect(redactPii('')).toBe('');
    expect(redactPii(null)).toBe('');
    expect(redactPii(undefined)).toBe('');
  });
  it('masks email addresses', () => {
    expect(redactPii('reach me at jane.doe@example.com tonight')).toBe(
      'reach me at [email] tonight',
    );
  });
  it('masks URLs', () => {
    expect(redactPii('see https://example.com/profile or www.example.org')).toBe(
      'see [link] or [link]',
    );
  });
  it('masks phone-like numbers', () => {
    expect(redactPii('call +1 (415) 555-1234 anytime')).toBe('call [phone] anytime');
  });
  it('masks @handles but leaves email-style untouched (already handled by email rule)', () => {
    expect(redactPii('find me @janedoe on socials')).toBe('find me [handle] on socials');
  });
  it('removes literal extras like a last name', () => {
    expect(redactPii('Jane Doe is great', { extras: ['Doe'] })).toBe('Jane [redacted] is great');
  });
  it('extras are case-insensitive but respect word boundaries', () => {
    const out = redactPii("don't ask about doe", { extras: ['Doe'] });
    expect(out).toBe("don't ask about [redacted]");
  });
});

describe('initialOnly', () => {
  it('returns a single uppercase initial with a period', () => {
    expect(initialOnly('jane')).toBe('J.');
    expect(initialOnly('  alex')).toBe('A.');
  });
  it('returns empty for empty input', () => {
    expect(initialOnly('')).toBe('');
    expect(initialOnly(null)).toBe('');
  });
});

describe('redactAttendeeForAi', () => {
  it('keeps only an initial and scrubs free text', () => {
    const out = redactAttendeeForAi({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '+1 415 555 1234',
      bio: 'Reach me at jane@example.com or @janedoe',
      hobbies: 'climbing',
    });
    expect(out.display_name).toBe('J.');
    expect(Object.keys(out)).not.toContain('last_name');
    expect(Object.keys(out)).not.toContain('email');
    expect(Object.keys(out)).not.toContain('phone');
    expect(out.bio).toContain('[email]');
    expect(out.bio).toContain('[handle]');
    expect(out.bio).not.toMatch(/jane@example\.com/);
    expect(out.hobbies).toBe('climbing');
  });
  it('removes first/last-name leakage in free text', () => {
    const out = redactAttendeeForAi({
      first_name: 'Jane',
      last_name: 'Doe',
      bio: 'Jane Doe loves climbing',
    });
    expect(out.bio).not.toMatch(/Doe/);
    expect(out.bio).not.toMatch(/Jane/);
  });
  it('defaults display_name when first_name missing', () => {
    const out = redactAttendeeForAi({ bio: 'hi' });
    expect(out.display_name).toBe('A.');
  });
});
