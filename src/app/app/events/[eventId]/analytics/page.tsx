import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

export default async function AnalyticsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await requireOrg();
  const { eventId } = await params;
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (!event) notFound();

  const [{ count: applications }, { count: approved }, { count: checkedIn }, { count: matches }, emailRows] = await Promise.all([
    svc.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    svc.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'approved'),
    svc.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('checked_in', true),
    svc.from('mutual_matches').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    svc.from('email_events').select('email_type, status').eq('event_id', eventId),
  ]);

  const attendanceRate = applications && approved ? Math.round((checkedIn ?? 0) / Math.max(1, approved) * 100) : 0;
  const matchRate = approved ? Math.round((matches ?? 0) / Math.max(1, approved) * 100) : 0;

  const emailStats = (emailRows.data ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = `${row.email_type ?? 'unknown'}:${row.status ?? 'unknown'}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const stats = [
    { label: 'Applications', value: applications ?? 0 },
    { label: 'Approved', value: approved ?? 0 },
    { label: 'Checked in', value: checkedIn ?? 0 },
    { label: 'Mutual matches', value: matches ?? 0 },
    { label: 'Attendance rate', value: `${attendanceRate}%` },
    { label: 'Match rate', value: `${matchRate}%` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold tabular-nums mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Email delivery</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(emailStats).length === 0 ? (
            <p className="text-sm text-muted-foreground">No email events yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {Object.entries(emailStats).map(([k, v]) => (
                <li key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="tabular-nums">{v}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
