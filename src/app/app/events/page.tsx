import Link from 'next/link';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

export default async function EventsListPage() {
  const ctx = await requireOrg();
  const svc = createServiceClient();
  const { data: events } = await svc
    .from('events')
    .select('id, title, status, starts_at, city, public_slug')
    .eq('organization_id', ctx.organizationId)
    .order('starts_at', { ascending: false, nullsFirst: false });

  return (
    <div className="container-px py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-muted-foreground">All your hosted events.</p>
        </div>
        <Button asChild><Link href="/app/events/new">New event</Link></Button>
      </div>
      {events && events.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <Card key={e.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{e.title}</span>
                  <Badge variant={e.status === 'live' ? 'live' : 'secondary'} className="capitalize">{e.status}</Badge>
                </CardTitle>
                <CardDescription>{e.city ?? '—'} · {formatDate(e.starts_at)}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button asChild variant="outline" size="sm"><Link href={`/app/events/${e.id}`}>Manage</Link></Button>
                <Button asChild variant="ghost" size="sm"><Link href={`/events/${e.public_slug}`}>Public</Link></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-10 pb-12 text-center">
            <h3 className="text-lg font-medium">No events yet</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Create your first event in under a minute.
            </p>
            <Button asChild><Link href="/app/events/new">Create event</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
