import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllUsage } from '@/lib/usage';
import { UsageCard } from '@/components/app/usage-card';
import { ActivityFeed, type ActivityRow } from '@/components/app/activity-feed';
import { formatDate } from '@/lib/utils';
import { Calendar, Users, HeartHandshake } from 'lucide-react';

export default async function DashboardPage() {
  const ctx = await requireOrg();
  const svc = createServiceClient();

  const [{ count: totalEvents }, { count: upcomingEvents }, attendeesAgg, matchesAgg, usage, activity] = await Promise.all([
    svc.from('events').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId),
    svc
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId)
      .gte('starts_at', new Date().toISOString()),
    svc
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    svc
      .from('mutual_matches')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId),
    getAllUsage(ctx.organizationId),
    svc
      .from('activity_events')
      .select('id, event_type, entity_type, metadata, created_at')
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const stats = [
    { label: 'Total events', value: totalEvents ?? 0, icon: Calendar },
    { label: 'Upcoming events', value: upcomingEvents ?? 0, icon: Calendar },
    { label: 'Attendees this month', value: attendeesAgg.count ?? 0, icon: Users },
    { label: 'Mutual matches', value: matchesAgg.count ?? 0, icon: HeartHandshake },
  ];

  return (
    <div className="container-px py-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">Real-time overview of your singles events.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/app/billing">Manage billing</Link></Button>
          <Button asChild><Link href="/app/events/new">New event</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-semibold mt-1 tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
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
                initial={(activity.data ?? []) as ActivityRow[]}
              />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <UsageCard items={usage.items} />
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current plan</span>
                <Badge variant="secondary" className="capitalize">{usage.plan}</Badge>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/app/billing">Upgrade or manage</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="sr-only">Last refreshed {formatDate(new Date())}.</p>
    </div>
  );
}
