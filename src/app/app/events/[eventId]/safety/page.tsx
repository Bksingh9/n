import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { requireOrg } from '@/lib/auth';
import { isAtLeast } from '@/lib/roles';
import { createServiceClient } from '@/lib/supabase/server';
import { listSafetyReports, resolveSafetyReport, setSafetyFlag } from '@/lib/services/safety';
import { formatDate } from '@/lib/utils';

const labels: Record<string, string> = {
  harassment: 'Harassment',
  misrepresentation: 'Misrepresentation',
  unsafe_behavior: 'Unsafe behavior',
  venue_concern: 'Venue concern',
  other: 'Other',
};

export default async function SafetyPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const ctx = await requireOrg();
  const { eventId } = await params;
  const sp = await searchParams;
  const status = sp.filter && ['open', 'resolved', 'dismissed'].includes(sp.filter) ? sp.filter : 'open';
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (!event) notFound();

  const reports = await listSafetyReports({ organizationId: ctx.organizationId, eventId, status });

  const ids = new Set<string>();
  reports.forEach((r) => {
    if (r.reporter_attendee_id) ids.add(r.reporter_attendee_id);
    if (r.reported_attendee_id) ids.add(r.reported_attendee_id);
  });
  const names = new Map<string, { first: string; last: string }>();
  if (ids.size > 0) {
    const { data } = await svc.from('attendees').select('id, first_name, last_name').in('id', Array.from(ids));
    (data ?? []).forEach((a) => names.set(a.id, { first: a.first_name ?? '', last: a.last_name ?? '' }));
  }

  async function resolveAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    if (!isAtLeast(c.role, 'admin')) redirect(`/app/events/${eventId}/safety?filter=${status}`);
    const reportId = formData.get('report_id')?.toString();
    const next = formData.get('next_status')?.toString() as 'resolved' | 'dismissed' | undefined;
    const note = formData.get('note')?.toString().slice(0, 1000) ?? '';
    const flagAttendeeId = formData.get('flag_attendee_id')?.toString() || null;
    if (!reportId || !next) redirect(`/app/events/${eventId}/safety?filter=${status}`);
    await resolveSafetyReport({
      organizationId: c.organizationId,
      userId: c.user.id,
      reportId,
      status: next,
      note,
    });
    if (flagAttendeeId) {
      await setSafetyFlag({ organizationId: c.organizationId, attendeeId: flagAttendeeId, value: true });
    }
    redirect(`/app/events/${eventId}/safety?filter=${status}`);
  }

  const tabs = ['open', 'resolved', 'dismissed'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Safety</h2>
          <p className="text-sm text-muted-foreground">
            Reports submitted by attendees through their private link. Only owners + admins can resolve.
          </p>
        </div>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <Button
              key={t}
              asChild
              size="sm"
              variant={status === t ? 'default' : 'outline'}
            >
              <a href={`/app/events/${eventId}/safety?filter=${t}`} className="capitalize">{t}</a>
            </Button>
          ))}
        </div>
      </div>

      {reports.length === 0 ? (
        <Card><CardContent className="pt-10 pb-12 text-center text-sm text-muted-foreground">
          No {status} reports.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const reporter = r.reporter_attendee_id ? names.get(r.reporter_attendee_id) : null;
            const reported = r.reported_attendee_id ? names.get(r.reported_attendee_id) : null;
            return (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 flex-wrap text-base">
                    <span>
                      {labels[r.category] ?? r.category}
                      {reported && <span className="text-muted-foreground"> · about {reported.first} {reported.last[0] ?? ''}.</span>}
                    </span>
                    <Badge variant={r.status === 'open' ? 'destructive' : 'secondary'} className="capitalize">{r.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {reporter ? `From ${reporter.first}` : 'Anonymous'} · {formatDate(r.created_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {r.details && <p className="text-sm whitespace-pre-line">{r.details}</p>}
                  {r.resolution_note && (
                    <p className="text-xs text-muted-foreground">Resolution note: {r.resolution_note}</p>
                  )}
                  {r.status === 'open' && (
                    <form action={resolveAction} className="space-y-2 pt-2 border-t">
                      <input type="hidden" name="report_id" value={r.id} />
                      <Textarea name="note" rows={2} placeholder="Resolution note (optional)" />
                      {r.reported_attendee_id && (
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="flag_attendee_id" value={r.reported_attendee_id} />
                          Also flag {reported?.first ?? 'reported attendee'} for follow-up
                        </label>
                      )}
                      <div className="flex gap-2">
                        <Button type="submit" name="next_status" value="resolved">Mark resolved</Button>
                        <Button type="submit" name="next_status" value="dismissed" variant="outline">Dismiss</Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
