import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requireOrg } from '@/lib/auth';
import { isAtLeast } from '@/lib/roles';
import { createServiceClient } from '@/lib/supabase/server';
import { listEventQuestions, listAnswersForAttendee } from '@/lib/services/questions';
import { setAttendeeStatus } from '@/lib/services/attendees';
import { setSafetyFlag } from '@/lib/services/safety';

export default async function AttendeeDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; attendeeId: string }>;
}) {
  const ctx = await requireOrg();
  const { eventId, attendeeId } = await params;
  const svc = createServiceClient();

  const { data: attendee } = await svc
    .from('attendees')
    .select('*')
    .eq('id', attendeeId)
    .eq('organization_id', ctx.organizationId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!attendee) notFound();

  const [questions, answers] = await Promise.all([
    listEventQuestions(ctx.organizationId, eventId),
    listAnswersForAttendee(attendeeId),
  ]);
  const answerMap = new Map<string, string>();
  answers.forEach((a) => { if (a.answer) answerMap.set(a.question_id, a.answer); });

  async function statusAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    const status = formData.get('status')?.toString() as 'approved' | 'declined' | 'waitlist' | undefined;
    if (!status) redirect(`/app/events/${eventId}/attendees/${attendeeId}`);
    await setAttendeeStatus({ organizationId: c.organizationId, userId: c.user.id, attendeeId, status });
    redirect(`/app/events/${eventId}/attendees/${attendeeId}`);
  }

  async function flagAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    if (!isAtLeast(c.role, 'admin')) redirect(`/app/events/${eventId}/attendees/${attendeeId}?error=Insufficient+role`);
    const value = formData.get('value')?.toString() === 'true';
    await setSafetyFlag({ organizationId: c.organizationId, attendeeId, value });
    redirect(`/app/events/${eventId}/attendees/${attendeeId}`);
  }

  return (
    <div className="space-y-6">
      <Link href={`/app/events/${eventId}/attendees`} className="text-xs text-muted-foreground hover:underline">
        ← Back to attendees
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
            <span>{attendee.first_name} {attendee.last_name}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">{attendee.status}</Badge>
              {attendee.checked_in && <Badge variant="success">Checked in</Badge>}
              {attendee.safety_flag && <Badge variant="destructive">Safety flag</Badge>}
            </div>
          </CardTitle>
          <CardDescription>{attendee.email}{attendee.phone ? ` · ${attendee.phone}` : ''}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <Field label="Age" value={attendee.age?.toString()} />
          <Field label="Gender" value={attendee.gender} />
          <Field label="Interested in" value={attendee.interested_in} />
          <Field label="Looking for" value={attendee.relationship_goal} />
          <Field label="Preferred age" value={
            attendee.preferred_age_min || attendee.preferred_age_max
              ? `${attendee.preferred_age_min ?? '—'}–${attendee.preferred_age_max ?? '—'}`
              : null
          } />
          <Field label="Consent to contact" value={attendee.consent_to_contact ? 'Yes' : 'No'} />
          {attendee.bio && <FullField label="Bio" value={attendee.bio} />}
          {attendee.hobbies && <FullField label="Hobbies" value={attendee.hobbies} />}
          {attendee.conversation_topics && <FullField label="Topics" value={attendee.conversation_topics} />}
          {attendee.dealbreakers && <FullField label="Dealbreakers" value={attendee.dealbreakers} />}
        </CardContent>
      </Card>

      {questions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Custom answers</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {questions.map((q) => (
                <li key={q.id}>
                  <div className="text-muted-foreground">{q.question}</div>
                  <div className="font-medium whitespace-pre-line">{answerMap.get(q.id) || '—'}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={statusAction} className="flex gap-2 flex-wrap">
            {attendee.status !== 'approved' && (
              <Button type="submit" name="status" value="approved">Approve</Button>
            )}
            {attendee.status !== 'waitlist' && (
              <Button type="submit" name="status" value="waitlist" variant="outline">Waitlist</Button>
            )}
            {attendee.status !== 'declined' && (
              <Button type="submit" name="status" value="declined" variant="ghost">Decline</Button>
            )}
          </form>
          <form action={flagAction}>
            <input type="hidden" name="value" value={attendee.safety_flag ? 'false' : 'true'} />
            <Button type="submit" variant={attendee.safety_flag ? 'outline' : 'destructive'}>
              {attendee.safety_flag ? 'Clear safety flag' : 'Flag for review'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || '—'}</div>
    </div>
  );
}

function FullField({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:col-span-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <p className="text-sm whitespace-pre-line mt-1">{value}</p>
    </div>
  );
}
