import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { createServiceClient } from '@/lib/supabase/server';
import { findAttendeeByToken } from '@/lib/services/attendees';
import { InterestSchema, submitInterest } from '@/lib/services/postevent';

export default async function PostEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const me = await findAttendeeByToken(token);
  if (!me) notFound();

  const svc = createServiceClient();
  const { data: others } = await svc
    .from('attendees')
    .select('id, first_name')
    .eq('event_id', me.event_id)
    .neq('id', me.id)
    .eq('checked_in', true);

  const { data: existing } = await svc
    .from('post_event_interests')
    .select('to_attendee_id, interest_type, consent_to_share_contact')
    .eq('event_id', me.event_id)
    .eq('from_attendee_id', me.id);
  const existingMap = new Map<string, { interest_type: string; consent: boolean }>();
  (existing ?? []).forEach((r) => existingMap.set(r.to_attendee_id, { interest_type: r.interest_type, consent: r.consent_to_share_contact }));

  async function submitAction(formData: FormData) {
    'use server';
    const parsed = InterestSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(`/post-event/${token}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
    }
    const r = await submitInterest(token, parsed.data);
    if (!r.ok) redirect(`/post-event/${token}?error=${encodeURIComponent(r.error ?? '')}`);
    redirect(`/post-event/${token}?submitted=1`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 container-px py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Who would you like to meet again?</CardTitle>
            <CardDescription>
              We&apos;ll only share contact info if both of you select each other AND consent to share.
            </CardDescription>
          </CardHeader>
        </Card>

        {sp.submitted && (
          <Card><CardContent className="pt-6 text-sm text-emerald-700">Saved. Pick more if you like.</CardContent></Card>
        )}
        {sp.error && (
          <Card><CardContent className="pt-6 text-sm text-destructive">{sp.error}</CardContent></Card>
        )}

        {(others ?? []).map((o) => {
          const existing = existingMap.get(o.id);
          return (
            <Card key={o.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  {o.first_name}
                  {existing && <Badge variant="success">Saved</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={submitAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <input type="hidden" name="to_attendee_id" value={o.id} />
                  <div className="space-y-1.5">
                    <Label htmlFor={`interest_${o.id}`}>Interest</Label>
                    <select
                      id={`interest_${o.id}`}
                      name="interest_type"
                      defaultValue={existing?.interest_type ?? 'romantic'}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="romantic">Romantic</option>
                      <option value="friendship">Friendship</option>
                      <option value="professional">Professional</option>
                    </select>
                  </div>
                  <label className="text-sm flex items-center gap-2 sm:col-span-1">
                    <input type="checkbox" name="consent_to_share_contact" defaultChecked={existing?.consent} />
                    Share my contact if mutual
                  </label>
                  <Button type="submit">Save</Button>
                </form>
              </CardContent>
            </Card>
          );
        })}

        {(!others || others.length === 0) && (
          <Card><CardContent className="pt-10 pb-12 text-center text-muted-foreground">
            No other attendees to choose from yet.
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
