// Per-event custom application questions. Hosts add questions of type
// `text`, `textarea`, `select`, or `multi_select`. The apply page renders
// them and saves answers into attendee_answers.

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import type { EventQuestionRow, AttendeeAnswerRow } from '@/lib/supabase/types';

export const QuestionTypes = ['text', 'textarea', 'select', 'multi_select'] as const;
export type QuestionType = (typeof QuestionTypes)[number];

export const QuestionSchema = z.object({
  question: z.string().min(1).max(280),
  type: z.enum(QuestionTypes),
  options: z.string().max(1000).optional(),
  required: z
    .union([z.literal('on'), z.literal('true'), z.boolean()])
    .optional()
    .transform((v) => v === 'on' || v === 'true' || v === true),
  sort_order: z.coerce.number().int().min(0).max(1000).optional(),
});

export type QuestionInput = z.infer<typeof QuestionSchema>;

const parseOptions = (raw?: string): string[] | null => {
  if (!raw) return null;
  const list = raw
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 50);
  return list.length > 0 ? list : null;
};

export const listEventQuestions = async (
  organizationId: string,
  eventId: string,
): Promise<EventQuestionRow[]> => {
  const svc = createServiceClient();
  const { data } = await svc
    .from('event_questions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []) as EventQuestionRow[];
};

export const listEventQuestionsForApply = async (eventId: string): Promise<EventQuestionRow[]> => {
  // Public-side helper — server action calls this without an org context.
  const svc = createServiceClient();
  const { data } = await svc
    .from('event_questions')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []) as EventQuestionRow[];
};

export const upsertQuestion = async (params: {
  organizationId: string;
  eventId: string;
  questionId?: string;
  input: QuestionInput;
}) => {
  const svc = createServiceClient();
  const options = parseOptions(params.input.options);
  if ((params.input.type === 'select' || params.input.type === 'multi_select') && !options) {
    return { ok: false as const, error: 'Choice questions need at least one option' };
  }

  if (params.questionId) {
    const { error } = await svc
      .from('event_questions')
      .update({
        question: params.input.question,
        type: params.input.type,
        options: options as never,
        required: params.input.required ?? false,
        sort_order: params.input.sort_order ?? 0,
      })
      .eq('id', params.questionId)
      .eq('organization_id', params.organizationId)
      .eq('event_id', params.eventId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, questionId: params.questionId };
  }

  const { data, error } = await svc
    .from('event_questions')
    .insert({
      organization_id: params.organizationId,
      event_id: params.eventId,
      question: params.input.question,
      type: params.input.type,
      options: options as never,
      required: params.input.required ?? false,
      sort_order: params.input.sort_order ?? 0,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? 'Could not save question' };
  return { ok: true as const, questionId: data.id };
};

export const deleteQuestion = async (params: {
  organizationId: string;
  eventId: string;
  questionId: string;
}) => {
  const svc = createServiceClient();
  const { error } = await svc
    .from('event_questions')
    .delete()
    .eq('id', params.questionId)
    .eq('organization_id', params.organizationId)
    .eq('event_id', params.eventId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
};

export const saveAttendeeAnswers = async (params: {
  organizationId: string;
  eventId: string;
  attendeeId: string;
  answers: Map<string, string>;
}) => {
  if (params.answers.size === 0) return;
  const svc = createServiceClient();
  const rows = Array.from(params.answers.entries()).map(([questionId, answer]) => ({
    organization_id: params.organizationId,
    event_id: params.eventId,
    attendee_id: params.attendeeId,
    question_id: questionId,
    answer,
  }));
  await svc.from('attendee_answers').insert(rows);
};

export const validateAndCollectAnswers = (
  questions: EventQuestionRow[],
  formData: FormData,
): { ok: true; answers: Map<string, string> } | { ok: false; error: string } => {
  const answers = new Map<string, string>();
  for (const q of questions) {
    const fieldName = `q_${q.id}`;
    const all = formData.getAll(fieldName).map(String).filter((s) => s.length > 0);
    let value: string | null = null;
    if (q.type === 'multi_select') {
      if (all.length > 0) value = all.join(', ');
    } else if (all.length > 0) {
      value = all[0];
    }
    if (q.required && !value) {
      return { ok: false, error: `"${q.question}" is required` };
    }
    if (value) {
      // Sanity-cap stored answers to keep DB clean.
      answers.set(q.id, value.slice(0, 4000));
    }
  }
  return { ok: true, answers };
};

export const listAnswersForAttendee = async (attendeeId: string): Promise<AttendeeAnswerRow[]> => {
  const svc = createServiceClient();
  const { data } = await svc
    .from('attendee_answers')
    .select('*')
    .eq('attendee_id', attendeeId);
  return (data ?? []) as AttendeeAnswerRow[];
};
