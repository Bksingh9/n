// Background job queue — producer + state machine only. Handlers live in
// services/job-handlers.ts to keep this module free of business-logic
// imports (which would create a cycle with services/postevent.ts).

import { createServiceClient } from '@/lib/supabase/server';
import type { JobRow } from '@/lib/supabase/types';

export type JobKind = 'send_intro_for_match' | 'send_event_reminder' | 'send_post_event_link';

export interface SendIntroPayload {
  match_id: string;
}

export interface SendReminderPayload {
  organization_id: string;
  event_id: string;
  event_title: string;
  starts_at: string;
  venue: string;
  recipient_email: string;
  recipient_first_name: string;
  check_in_url: string;
  window: '24h' | '1h';
}

export interface SendPostEventPayload {
  organization_id: string;
  event_id: string;
  event_title: string;
  recipient_email: string;
  recipient_first_name: string;
  post_event_url: string;
}

export const computeBackoffMs = (attempts: number): number =>
  Math.min(60 * 60_000, 60_000 * 2 ** attempts);

export const enqueueJob = async (params: {
  kind: JobKind;
  organizationId?: string | null;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> => {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('jobs')
    .insert({
      organization_id: params.organizationId ?? null,
      kind: params.kind,
      payload: params.payload as never,
      max_attempts: params.maxAttempts ?? 5,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'enqueue failed' };
  return { ok: true, jobId: data.id };
};

export const claimReadyJobs = async (limit = 20): Promise<JobRow[]> => {
  const svc = createServiceClient();
  // Two-step claim: read eligible rows, then attempt status='pending' →
  // 'running' transitions one-by-one. Concurrent workers can both read a
  // row, but only one wins the conditional update, so no double-claim.
  const { data: candidates } = await svc
    .from('jobs')
    .select('id, attempts')
    .eq('status', 'pending')
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true })
    .limit(limit);

  const claimed: JobRow[] = [];
  for (const c of candidates ?? []) {
    const { data: row, error } = await svc
      .from('jobs')
      .update({
        status: 'running',
        attempts: c.attempts + 1,
        started_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', c.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    if (!error && row) claimed.push(row as JobRow);
  }
  return claimed;
};

export const markJobDone = async (jobId: string) => {
  const svc = createServiceClient();
  await svc
    .from('jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString(), last_error: null })
    .eq('id', jobId);
};

export const markJobFailed = async (jobId: string, attempts: number, maxAttempts: number, err: unknown) => {
  const svc = createServiceClient();
  const message = err instanceof Error ? err.message : String(err);
  if (attempts >= maxAttempts) {
    await svc
      .from('jobs')
      .update({ status: 'dead', completed_at: new Date().toISOString(), last_error: message.slice(0, 1000) })
      .eq('id', jobId);
    return;
  }
  await svc
    .from('jobs')
    .update({
      status: 'pending',
      next_run_at: new Date(Date.now() + computeBackoffMs(attempts)).toISOString(),
      last_error: message.slice(0, 1000),
      started_at: null,
    })
    .eq('id', jobId);
};
