import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { publishEvent } from '@/lib/services/events';
import { ActivityFeed, type ActivityRow } from '@/components/app/activity-feed';
import { CopyButton } from '@/components/app/copy-button';
import { publicEnv } from '@/lib/env';
import { formatDate } from '@/lib/utils';

export default async function EventOverview({ params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await requireOrg();
  const { eventId } = await params;
  const svc = createServiceClient();

  const { data: event } = await svc
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (!event) notFound();

  const [{ count: attendeeCount }, { count: checkedInCount }, { count: matchCount }, activity] = await Promise.all([
    svc.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    svc.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('checked_in', true),
    svc.from('mutual_matches').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    svc
      .from('activity_events')
      .select('id, event_type, entity_type, metadata, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const publicUrl = `${publicEnv.APP_URL}/events/${event.public_slug}`;
  const applyUrl = `${publicEnv.APP_URL}/apply/${event.public_slug}`;

  async function publishAction() {
    'use server';
    const c = await requireOrg();
    await publishEvent({ organizationId: c.organizationId, userId: c.user.id, eventId });
    redirect(`/app/events/${eventId}`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Attendees</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{attendeeCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Checked in</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{checkedInCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Mutual matches</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{matchCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Public links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Event page</p>
                <p className="text-sm text-muted-foreground break-all">{publicUrl}</p>
              </div>
              <CopyButton value={publicUrl} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Apply</p>
                <p className="text-sm text-muted-foreground break-all">{applyUrl}</p>
              </div>
              <CopyButton value={applyUrl} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current</span>
              <Badge variant={event.status === 'live' ? 'live' : 'secondary'} className="capitalize">{event.status}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">{formatDate(event.starts_at)}</div>
            {event.status === 'draft' && (
              <form action={publishAction}>
                <Button className="w-full" type="submit">Publish event</Button>
              </form>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href={`/app/events/${eventId}/live`}>Go to live command center</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Recent activity
            <Badge variant="live">Live</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed
            organizationId={ctx.organizationId}
            eventId={event.id}
            initial={(activity.data ?? []) as ActivityRow[]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
