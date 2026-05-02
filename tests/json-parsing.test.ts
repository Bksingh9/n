import { describe, expect, it } from 'vitest';
import { parseJsonStrict } from '@/lib/matching/anthropic';

describe('parseJsonStrict', () => {
  it('parses raw JSON', () => {
    const obj = parseJsonStrict('{"score": 80}');
    expect(obj.score).toBe(80);
  });
  it('strips fenced code blocks', () => {
    const obj = parseJsonStrict('```json\n{"score": 70}\n```');
    expect(obj.score).toBe(70);
  });
  it('extracts JSON when wrapped in prose', () => {
    const obj = parseJsonStrict('Here you go: {"score": 60, "summary": "ok"} thanks!');
    expect(obj.score).toBe(60);
    expect(obj.summary).toBe('ok');
  });
  it('throws on non-object response', () => {
    expect(() => parseJsonStrict('"just a string"')).toThrow();
  });
});
