import { describe, expect, it } from 'vitest';

// Pure logic: if A->B exists AND B->A exists, it's a mutual match.
// Intro emails only when both sides set consent_to_share_contact = true
// AND both attendees have consent_to_contact = true.

interface Interest {
  from: string;
  to: string;
  interest: 'romantic' | 'friendship' | 'professional';
  consent: boolean;
}

const isMutual = (a: Interest, b: Interest) => a.from === b.to && a.to === b.from;
const introOk = (a: Interest, b: Interest, contactConsents: { a: boolean; b: boolean }) =>
  isMutual(a, b) && a.consent && b.consent && contactConsents.a && contactConsents.b;

describe('mutual match detection', () => {
  it('detects bidirectional interest', () => {
    const a: Interest = { from: 'a', to: 'b', interest: 'romantic', consent: true };
    const b: Interest = { from: 'b', to: 'a', interest: 'romantic', consent: true };
    expect(isMutual(a, b)).toBe(true);
  });
  it('rejects unidirectional', () => {
    const a: Interest = { from: 'a', to: 'b', interest: 'romantic', consent: true };
    const b: Interest = { from: 'c', to: 'a', interest: 'romantic', consent: true };
    expect(isMutual(a, b)).toBe(false);
  });
});

describe('intro email gating', () => {
  it('blocks intro when one side did not consent to share contact', () => {
    const a: Interest = { from: 'a', to: 'b', interest: 'romantic', consent: true };
    const b: Interest = { from: 'b', to: 'a', interest: 'romantic', consent: false };
    expect(introOk(a, b, { a: true, b: true })).toBe(false);
  });
  it('blocks intro when one side did not consent to contact at signup', () => {
    const a: Interest = { from: 'a', to: 'b', interest: 'romantic', consent: true };
    const b: Interest = { from: 'b', to: 'a', interest: 'romantic', consent: true };
    expect(introOk(a, b, { a: false, b: true })).toBe(false);
    expect(introOk(a, b, { a: true, b: false })).toBe(false);
  });
  it('sends intro only with full consent on both sides', () => {
    const a: Interest = { from: 'a', to: 'b', interest: 'romantic', consent: true };
    const b: Interest = { from: 'b', to: 'a', interest: 'romantic', consent: true };
    expect(introOk(a, b, { a: true, b: true })).toBe(true);
  });
});
