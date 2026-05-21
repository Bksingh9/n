import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requireOrg } from '@/lib/auth';
import { isAtLeast } from '@/lib/roles';
import {
  cancelJob,
  countJobsByStatus,
  listJobsForOrg,
  retryJob,
  type JobStatus,
} from '@/lib/services/jobs-admin';
import { formatDate } from '@/lib/utils';

const STATUSES: JobStatus[] = ['pending', 'running', 'completed', 'dead'];

const labels: Record<string, string> = {
  send_intro_for_match: 'Intro email',
  send_event_reminder: 'Event reminder',
  send_post_event_link: 'Post-event link',
};

export default async function JobsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; ok?: string }>;
}) {
  const ctx = await requireOrg();
  if (!isAtLeast(ctx.role, 'admin')) {
    return (
      <div className="container-px py-8 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Background jobs</CardTitle>
            <CardDescription>Owners and admins can view and retry queued background jobs.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  const sp = await searchParams;
  const status = (STATUSES as string[]).includes(sp.status ?? '') ? (sp.status as JobStatus) : 'dead';
  const [jobs, counts] = await Promise.all([
    listJobsForOrg({ organizationId: ctx.organizationId, status, limit: 100 }),
    countJobsByStatus(ctx.organizationId),
  ]);

  async function retryAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    if (!isAtLeast(c.role, 'admin')) redirect(`/app/jobs?status=${status}`);
    const jobId = formData.get('job_id')?.toString();
    if (!jobId) redirect(`/app/jobs?status=${status}`);
    const r = await retryJob({ organizationId: c.organizationId, jobId });
    redirect(r.ok ? `/app/jobs?status=pending&ok=1` : `/app/jobs?status=${status}&error=${encodeURIComponent(r.error)}`);
  }

  async function cancelAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    if (!isAtLeast(c.role, 'admin')) redirect(`/app/jobs?status=${status}`);
    const jobId = formData.get('job_id')?.toString();
    if (!jobId) redirect(`/app/jobs?status=${status}`);
    const r = await cancelJob({ organizationId: c.organizationId, jobId });
    redirect(r.ok ? `/app/jobs?status=${status}&ok=1` : `/app/jobs?status=${status}&error=${encodeURIComponent(r.error)}`);
  }

  return (
    <div className="container-px py-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Background jobs</h1>
          <p className="text-muted-foreground">
            Async work — intro emails, reminders, post-event links. Jobs retry automatically with exponential backoff up to 5 attempts before landing in <strong>dead</strong>.
          </p>
        </div>
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <Button
              key={s}
              asChild
              size="sm"
              variant={status === s ? 'default' : 'outline'}
            >
              <a href={`/app/jobs?status=${s}`} className="capitalize">
                {s} <span className="ml-1.5 text-xs tabular-nums opacity-70">{counts[s]}</span>
              </a>
            </Button>
          ))}
        </div>
      </div>

      {sp.ok && <p className="text-sm text-emerald-700">Updated.</p>}
      {sp.error && <p className="text-sm text-destructive">{sp.error}</p>}

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-12 text-center text-sm text-muted-foreground">
            No {status} jobs.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => (
            <Card key={j.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 flex-wrap text-base">
                  <span>
                    {labels[j.kind] ?? j.kind}
                    <span className="text-muted-foreground"> · attempts {j.attempts}/{j.max_attempts}</span>
                  </span>
                  <Badge
                    variant={
                      j.status === 'dead'
                        ? 'destructive'
                        : j.status === 'completed'
                          ? 'success'
                          : j.status === 'running'
                            ? 'live'
                            : 'secondary'
                    }
                    className="capitalize"
                  >
                    {j.status}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Queued {formatDate(j.created_at)}
                  {j.completed_at ? ` · finished ${formatDate(j.completed_at)}` : ''}
                  {j.status === 'pending' && j.next_run_at ? ` · next run ${formatDate(j.next_run_at)}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {j.last_error && (
                  <p className="text-sm text-destructive whitespace-pre-line">{j.last_error}</p>
                )}
                <div className="flex gap-2">
                  {j.status === 'dead' && (
                    <form action={retryAction}>
                      <input type="hidden" name="job_id" value={j.id} />
                      <Button type="submit" size="sm">Retry</Button>
                    </form>
                  )}
                  {(j.status === 'pending' || j.status === 'dead') && (
                    <form action={cancelAction}>
                      <input type="hidden" name="job_id" value={j.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        {j.status === 'pending' ? 'Cancel' : 'Discard'}
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
