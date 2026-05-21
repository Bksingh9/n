// Host-facing job management. Lists recent jobs scoped to an organization
// and provides retry / cancel actions. Strictly distinct from the queue
// internals in services/jobs.ts so admin pages don't pull in the worker
// dispatch chain.

import { createServiceClient } from '@/lib/supabase/server';
import type { JobRow } from '@/lib/supabase/types';

export type JobStatus = 'pending' | 'running' | 'completed' | 'dead';

export const listJobsForOrg = async (params: {
  organizationId: string;
  status?: JobStatus;
  limit?: number;
}): Promise<JobRow[]> => {
  const svc = createServiceClient();
  let query = svc
    .from('jobs')
    .select('*')
    .eq('organization_id', params.organizationId)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 100);
  if (params.status) query = query.eq('status', params.status);
  const { data } = await query;
  return (data ?? []) as JobRow[];
};

export const retryJob = async (params: {
  organizationId: string;
  jobId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  const svc = createServiceClient();
  // Only `dead` jobs are eligible for manual retry — pending/running are
  // already on track, and completed jobs shouldn't be re-run.
  const { data, error } = await svc
    .from('jobs')
    .update({
      status: 'pending',
      next_run_at: new Date().toISOString(),
      attempts: 0,
      last_error: null,
      started_at: null,
      completed_at: null,
    })
    .eq('id', params.jobId)
    .eq('organization_id', params.organizationId)
    .eq('status', 'dead')
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Job is not in a retryable state' };
  return { ok: true };
};

export const cancelJob = async (params: {
  organizationId: string;
  jobId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('jobs')
    .update({
      status: 'dead',
      last_error: 'Cancelled by host',
      completed_at: new Date().toISOString(),
    })
    .eq('id', params.jobId)
    .eq('organization_id', params.organizationId)
    .in('status', ['pending', 'dead'])
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Job cannot be cancelled' };
  return { ok: true };
};

export const countJobsByStatus = async (
  organizationId: string,
): Promise<Record<JobStatus, number>> => {
  const svc = createServiceClient();
  const statuses: JobStatus[] = ['pending', 'running', 'completed', 'dead'];
  const out: Record<JobStatus, number> = { pending: 0, running: 0, completed: 0, dead: 0 };
  await Promise.all(
    statuses.map(async (s) => {
      const { count } = await svc
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', s);
      out[s] = count ?? 0;
    }),
  );
  return out;
};
