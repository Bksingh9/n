import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { runMatching } from '@/lib/services/matching';

export default async function MatchingPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string; ran?: string }>;
}) {
  const ctx = await requireOrg();
  const { eventId } = await params;
  const sp = await searchParams;
  const svc = createServiceClient();

  const { data: event } = await svc
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (!event) notFound();

  const { data: scores } = await svc
    .from('compatibility_scores')
    .select('id, attendee_a_id, attendee_b_id, score, summary, preference_conflict, reasons')
    .eq('event_id', eventId)
    .order('score', { ascending: false })
    .limit(50);

  const ids = new Set<string>();
  (scores ?? []).forEach((s) => {
    ids.add(s.attendee_a_id);
    ids.add(s.attendee_b_id);
  });
  const attendeeMap = new Map<string, string>();
  if (ids.size > 0) {
    const { data: attendees } = await svc
      .from('attendees')
      .select('id, first_name')
      .in('id', Array.from(ids));
    (attendees ?? []).forEach((a) => attendeeMap.set(a.id, a.first_name ?? 'Attendee'));
  }

  async function runDeterministic() {
    'use server';
    const c = await requireOrg();
    const r = await runMatching({ organizationId: c.organizationId, userId: c.user.id, eventId, useAi: false });
    redirect(r.ok ? `/app/events/${eventId}/matching?ran=1` : `/app/events/${eventId}/matching?error=${encodeURIComponent(r.error ?? '')}`);
  }
  async function runAi() {
    'use server';
    const c = await requireOrg();
    const r = await runMatching({ organizationId: c.organizationId, userId: c.user.id, eventId, useAi: true });
    redirect(r.ok ? `/app/events/${eventId}/matching?ran=1` : `/app/events/${eventId}/matching?error=${encodeURIComponent(r.error ?? '')}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Compatibility scoring</h2>
          <p className="text-muted-foreground text-sm">Run deterministic scoring (free) or AI-augmented summaries.</p>
        </div>
        <div className="flex gap-2">
          <form action={runDeterministic}><Button variant="outline" type="submit">Run deterministic</Button></form>
          <form action={runAi}><Button type="submit">Run with AI</Button></form>
        </div>
      </div>
      {sp.ran && <p className="text-sm text-emerald-700">Matching complete.</p>}
      {sp.error && <p className="text-sm text-destructive">{sp.error}</p>}

      {!scores || scores.length === 0 ? (
        <Card><CardContent className="pt-10 pb-12 text-center text-muted-foreground">
          No matches yet. Approve attendees and run matching.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {scores.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{attendeeMap.get(s.attendee_a_id)} ↔ {attendeeMap.get(s.attendee_b_id)}</span>
                  <Badge variant={s.preference_conflict ? 'warning' : 'success'}>{s.score}</Badge>
                </CardTitle>
                {s.summary && <CardDescription>{s.summary}</CardDescription>}
              </CardHeader>
              <CardContent>
                {Array.isArray(s.reasons) && s.reasons.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {(s.reasons as string[]).slice(0, 4).map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
