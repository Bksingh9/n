import { describe, expect, it } from 'vitest';
import { QuestionSchema, validateAndCollectAnswers } from '@/lib/services/questions';
import type { EventQuestionRow } from '@/lib/supabase/types';

const baseQ = (overrides: Partial<EventQuestionRow>): EventQuestionRow => ({
  id: overrides.id ?? 'q1',
  organization_id: 'org',
  event_id: 'evt',
  question: overrides.question ?? 'Question',
  type: overrides.type ?? 'text',
  options: overrides.options ?? null,
  required: overrides.required ?? false,
  sort_order: overrides.sort_order ?? 0,
  created_at: '2030-01-01T00:00:00Z',
});

describe('QuestionSchema', () => {
  it('accepts a basic text question', () => {
    expect(QuestionSchema.safeParse({ question: 'Why?', type: 'text' }).success).toBe(true);
  });
  it('coerces required from "on" to true', () => {
    const r = QuestionSchema.safeParse({ question: 'q', type: 'text', required: 'on' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.required).toBe(true);
  });
  it('rejects unknown type', () => {
    expect(QuestionSchema.safeParse({ question: 'q', type: 'phone' }).success).toBe(false);
  });
});

describe('validateAndCollectAnswers', () => {
  it('errors on missing required answer', () => {
    const fd = new FormData();
    const r = validateAndCollectAnswers([baseQ({ id: 'q1', required: true })], fd);
    expect(r.ok).toBe(false);
  });
  it('collects single-value answers', () => {
    const fd = new FormData();
    fd.set('q_q1', 'hello');
    const r = validateAndCollectAnswers([baseQ({ id: 'q1' })], fd);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answers.get('q1')).toBe('hello');
  });
  it('joins multi-select answers with comma', () => {
    const fd = new FormData();
    fd.append('q_q1', 'a');
    fd.append('q_q1', 'b');
    fd.append('q_q1', 'c');
    const r = validateAndCollectAnswers([baseQ({ id: 'q1', type: 'multi_select' })], fd);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answers.get('q1')).toBe('a, b, c');
  });
  it('caps stored answer length at 4000 chars', () => {
    const fd = new FormData();
    fd.set('q_q1', 'x'.repeat(8000));
    const r = validateAndCollectAnswers([baseQ({ id: 'q1' })], fd);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answers.get('q1')!.length).toBe(4000);
  });
});
