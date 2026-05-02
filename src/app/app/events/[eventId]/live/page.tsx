import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { startEvent, endEvent, startNextRound, endCurrentRound } from '@/lib/services/live';
import { ActivityFeed, type ActivityRow } from '@/components/app/activity-feed';
import { LiveTimer } from '@/components/app/live-timer';

export default async function LivePage({ params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await requireOrg();
  const { eventId } = await params;
  const svc = createServiceClient();

  const { data: event } = await svc
    .from('events')
    .select('id, title, status, current_round, round_started_at, round_ends_at')
    .eq('id', eventId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (!event) notFound();

  const [{ count: checkedIn }, currentTables, activity] = await Promise.all([
    svc.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('checked_in', true),
    event.current_round
      ? svc
          .from('rotation_rounds')
          .select('id, table_number, attendee_a_id, attendee_b_id, status')
          .eq('event_id', eventId)
          .eq('round_number', event.current_round)
          .order('table_number', { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; table_number: number; attendee_a_id: string | null; attendee_b_id: string | null; status: string }> }),
    svc
      .from('activity_events')
      .select('id, event_type, entity_type, metadata, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const ids = new Set<string>();
  (currentTables.data ?? []).forEach((t) => {
    if (t.attendee_a_id) ids.add(t.attendee_a_id);
    if (t.attendee_b_id) ids.add(t.attendee_b_id);
  });
  const names = new Map<string, string>();
  if (ids.size > 0) {
    const { data } = await svc.from('attendees').select('id, first_name').in('id', Array.from(ids));
    (data ?? []).forEach((a) => names.set(a.id, a.first_name ?? 'Attendee'));
  }

  async function startEventAction() {
    'use server';
    const c = await requireOrg();
    await startEvent({ organizationId: c.organizationId, userId: c.user.id, eventId });
    redirect(`/app/events/${eventId}/live`);
  }
  async function nextRoundAction() {
    'use server';
    const c = await requireOrg();
    await startNextRound({ organizationId: c.organizationId, userId: c.user.id, eventId });
    redirect(`/app/events/${eventId}/live`);
  }
  async function endRoundAction() {
    'use server';
    const c = await requireOrg();
    await endCurrentRound({ organizationId: c.organizationId, userId: c.user.id, eventId });
    redirect(`/app/events/${eventId}/live`);
  }
  async function endEventAction() {
    'use server';
    const c = await requireOrg();
    await endEvent({ organizationId: c.organizationId, userId: c.user.id, eventId });
    redirect(`/app/events/${eventId}/live`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant={event.status === 'live' ? 'live' : 'secondary'} className="mt-1 capitalize">{event.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Checked-in</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{checkedIn ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Round timer</p>
            <LiveTimer endsAt={event.round_ends_at} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            Current round {event.current_round ? `· ${event.current_round}` : ''}
            <div className="flex gap-2">
              {event.status !== 'live' && event.status !== 'completed' && (
                <form action={startEventAction}><Button type="submit">Start event</Button></form>
              )}
              {event.status === 'live' && !event.round_started_at && (
                <form action={nextRoundAction}><Button type="submit">Start next round</Button></form>
              )}
              {event.status === 'live' && event.round_started_at && (
                <form action={endRoundAction}><Button type="submit" variant="outline">End round</Button></form>
              )}
              {event.status === 'live' && (
                <form action={endEventAction}><Button type="submit" variant="ghost">End event</Button></form>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!event.current_round ? (
            <p className="text-sm text-muted-foreground">No round in progress.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(currentTables.data ?? []).map((t) => (
                <div key={t.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="font-medium">Table {t.table_number || '—'}</div>
                  <div className="text-muted-foreground">{names.get(t.attendee_a_id ?? '') ?? '—'} ↔ {names.get(t.attendee_b_id ?? '') ?? 'Rest'}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Activity feed
            <Badge variant="live">Live</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed organizationId={ctx.organizationId} eventId={eventId} initial={(activity.data ?? []) as ActivityRow[]} />
        </CardContent>
      </Card>
    </div>
  );
}
