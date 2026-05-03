import { describe, expect, it } from 'vitest';
import { toCsv } from '@/lib/csv';

describe('toCsv', () => {
  it('emits header + rows', () => {
    const out = toCsv([{ a: 1, b: 'x' }, { a: 2, b: 'y' }], ['a', 'b']);
    expect(out).toBe('a,b\n1,x\n2,y\n');
  });
  it('quotes fields with commas, quotes, or newlines', () => {
    const out = toCsv([{ s: 'hello, world' }, { s: 'she said "hi"' }, { s: 'two\nlines' }], ['s']);
    expect(out).toBe(`s\n"hello, world"\n"she said ""hi"""\n"two\nlines"\n`);
  });
  it('handles null + undefined as empty', () => {
    const out = toCsv([{ a: null, b: undefined }], ['a', 'b']);
    expect(out).toBe('a,b\n,\n');
  });
});
