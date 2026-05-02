import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export default async function MatchesPage({ params }: { params: Promise<{ eventId: string }> }) {
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

  const { data: matches } = await svc
    .from('mutual_matches')
    .select('id, attendee_a_id, attendee_b_id, match_type, intro_email_sent, intro_email_sent_at, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  const ids = new Set<string>();
  (matches ?? []).forEach((m) => { ids.add(m.attendee_a_id); ids.add(m.attendee_b_id); });
  const names = new Map<string, string>();
  if (ids.size > 0) {
    const { data } = await svc.from('attendees').select('id, first_name, last_name').in('id', Array.from(ids));
    (data ?? []).forEach((a) => names.set(a.id, `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Attendee'));
  }

  return (
    <Card>
      <CardHeader><CardTitle>Mutual matches ({matches?.length ?? 0})</CardTitle></CardHeader>
      <CardContent>
        {!matches || matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mutual matches yet. Share post-event links with attendees.</p>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{names.get(m.attendee_a_id)} ↔ {names.get(m.attendee_b_id)}</span>
                  <span className="text-muted-foreground"> · {m.match_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  {m.intro_email_sent ? (
                    <Badge variant="success">Intro sent {m.intro_email_sent_at ? `· ${formatDate(m.intro_email_sent_at)}` : ''}</Badge>
                  ) : (
                    <Badge variant="warning">Awaiting consent</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
