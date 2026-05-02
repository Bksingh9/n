import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { type UsageMetric } from '@/lib/plans';

const LABELS: Record<UsageMetric, string> = {
  events_created: 'Events created',
  attendees_registered: 'Attendees registered',
  ai_matching_runs: 'AI matching runs',
  emails_sent: 'Emails sent',
  team_members_added: 'Team members',
};

export function UsageCard({
  items,
}: {
  items: Array<{ metric: UsageMetric; used: number; limit: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>This month&apos;s usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((row) => {
          const pct = row.limit > 0 ? Math.min(100, Math.round((row.used / row.limit) * 100)) : 0;
          return (
            <div key={row.metric} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{LABELS[row.metric]}</span>
                <span className="text-muted-foreground tabular-nums">
                  {row.used} / {row.limit}
                </span>
              </div>
              <Progress value={pct} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
