import { describe, expect, it } from 'vitest';
import {
  domainOf,
  isFormatValid,
  parseDisifyResponse,
  validateEmail,
} from '@/lib/integrations/email-validation';

describe('domainOf', () => {
  it('extracts the domain', () => {
    expect(domainOf('a@b.co')).toBe('b.co');
    expect(domainOf('Foo@Bar.COM')).toBe('bar.com');
  });
  it('returns empty for malformed input', () => {
    expect(domainOf('no-at-sign')).toBe('');
  });
});

describe('isFormatValid', () => {
  it('accepts well-formed addresses', () => {
    expect(isFormatValid('a@b.co')).toBe(true);
    expect(isFormatValid('first.last+tag@example.com')).toBe(true);
  });
  it('rejects malformed input', () => {
    expect(isFormatValid('not-an-email')).toBe(false);
    expect(isFormatValid('a@b')).toBe(false);
    expect(isFormatValid('@b.co')).toBe(false);
  });
});

describe('parseDisifyResponse', () => {
  it('reads format + disposable', () => {
    expect(parseDisifyResponse({ format: true, disposable: false })).toEqual({
      valid_format: true,
      disposable: false,
    });
  });
  it('rejects unexpected shapes', () => {
    expect(parseDisifyResponse({})).toBeNull();
    expect(parseDisifyResponse({ format: true })).toBeNull();
    expect(parseDisifyResponse(null)).toBeNull();
    expect(parseDisifyResponse('not an object')).toBeNull();
  });
});

describe('validateEmail (offline denylist path)', () => {
  it('flags known burner domains without a network call', async () => {
    const r = await validateEmail('foo@mailinator.com');
    expect(r.disposable).toBe(true);
    expect(r.source).toBe('denylist');
  });
  it('reports invalid format without a network call', async () => {
    const r = await validateEmail('not-an-email');
    expect(r.valid_format).toBe(false);
    expect(r.source).toBe('denylist');
  });
});
