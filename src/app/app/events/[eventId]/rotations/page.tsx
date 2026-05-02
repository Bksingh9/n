import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { generateAndSaveRotations } from '@/lib/services/matching';
import { z } from 'zod';

const Schema = z.object({
  table_count: z.coerce.number().int().min(1).max(50),
  round_count: z.coerce.number().int().min(1).max(20),
  round_duration_minutes: z.coerce.number().int().min(2).max(60),
  break_duration_minutes: z.coerce.number().int().min(0).max(30),
  start_time: z.string().min(1),
});

export default async function RotationsPage({ params, searchParams }: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
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

  const { data: rounds } = await svc
    .from('rotation_rounds')
    .select('id, round_number, table_number, attendee_a_id, attendee_b_id, status')
    .eq('event_id', eventId)
    .order('round_number', { ascending: true })
    .order('table_number', { ascending: true });

  const ids = new Set<string>();
  (rounds ?? []).forEach((r) => {
    if (r.attendee_a_id) ids.add(r.attendee_a_id);
    if (r.attendee_b_id) ids.add(r.attendee_b_id);
  });
  const names = new Map<string, string>();
  if (ids.size > 0) {
    const { data: attendees } = await svc.from('attendees').select('id, first_name').in('id', Array.from(ids));
    (attendees ?? []).forEach((a) => names.set(a.id, a.first_name ?? 'Attendee'));
  }

  const grouped = new Map<number, typeof rounds>();
  (rounds ?? []).forEach((r) => {
    const list = grouped.get(r.round_number) ?? [];
    list.push(r);
    grouped.set(r.round_number, list);
  });

  async function generate(formData: FormData) {
    'use server';
    const c = await requireOrg();
    const parsed = Schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(`/app/events/${eventId}/rotations?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
    }
    const r = await generateAndSaveRotations({
      organizationId: c.organizationId,
      userId: c.user.id,
      eventId,
      options: parsed.data,
    });
    if (!r.ok) redirect(`/app/events/${eventId}/rotations?error=${encodeURIComponent(r.error ?? '')}`);
    redirect(`/app/events/${eventId}/rotations?ok=1`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rotation generator</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={generate} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="table_count">Tables</Label>
              <Input id="table_count" name="table_count" type="number" defaultValue={5} min={1} max={50} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="round_count">Rounds</Label>
              <Input id="round_count" name="round_count" type="number" defaultValue={6} min={1} max={20} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="round_duration_minutes">Round (min)</Label>
              <Input id="round_duration_minutes" name="round_duration_minutes" type="number" defaultValue={6} min={2} max={60} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="break_duration_minutes">Break (min)</Label>
              <Input id="break_duration_minutes" name="break_duration_minutes" type="number" defaultValue={2} min={0} max={30} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start_time">Start time</Label>
              <Input id="start_time" name="start_time" type="datetime-local" required />
            </div>
            <div className="col-span-2 md:col-span-5">
              <Button type="submit">Generate</Button>
              {sp.error && <span className="ml-3 text-sm text-destructive">{sp.error}</span>}
              {sp.ok && <span className="ml-3 text-sm text-emerald-700">Rotations generated.</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      {Array.from(grouped.entries()).map(([roundNumber, list]) => (
        <Card key={roundNumber}>
          <CardHeader>
            <CardTitle className="text-base">Round {roundNumber}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list?.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">Table {r.table_number || '—'}</span>
                    <span className="text-muted-foreground"> · {names.get(r.attendee_a_id ?? '') ?? '—'} ↔ {names.get(r.attendee_b_id ?? '') ?? 'Rest'}</span>
                  </div>
                  <Badge variant={r.status === 'rest' ? 'secondary' : 'success'} className="capitalize">{r.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
