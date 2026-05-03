import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createServiceClient } from '@/lib/supabase/server';
import { ApplicationSchema, applyToEvent } from '@/lib/services/attendees';
import { sendApplicationReceived } from '@/lib/email/send';
import { listEventQuestionsForApply, validateAndCollectAnswers } from '@/lib/services/questions';

export default async function ApplyPage({ params, searchParams }: {
  params: Promise<{ eventSlug: string }>;
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const { eventSlug } = await params;
  const sp = await searchParams;
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id, title, status, public_slug, application_deadline')
    .eq('public_slug', eventSlug)
    .maybeSingle();
  if (!event) notFound();

  const questions = await listEventQuestionsForApply(event.id);

  async function applyAction(formData: FormData) {
    'use server';
    const raw = Object.fromEntries(formData);
    const parsed = ApplicationSchema.safeParse(raw);
    if (!parsed.success) {
      redirect(`/apply/${eventSlug}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
    }
    const answersResult = validateAndCollectAnswers(questions, formData);
    if (!answersResult.ok) {
      redirect(`/apply/${eventSlug}?error=${encodeURIComponent(answersResult.error)}`);
    }
    const res = await applyToEvent({
      eventSlug,
      input: parsed.data,
      answers: answersResult.answers,
    });
    if (!res.ok || !res.privateToken) {
      redirect(`/apply/${eventSlug}?error=${encodeURIComponent(res.error ?? 'Could not submit')}`);
    }
    void sendApplicationReceived({
      attendeeEmail: parsed.data.email,
      attendeeFirstName: parsed.data.first_name,
      eventTitle: event!.title,
      checkInToken: res.privateToken,
      eventId: event!.id,
    });
    redirect(`/apply/${eventSlug}?submitted=1`);
  }

  if (sp.submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 flex items-center justify-center container-px py-12">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Application received</CardTitle>
            <CardDescription>Thanks! The host will review your application and email you next steps.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 container-px py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Apply: {event.title}</CardTitle>
            <CardDescription>
              Your information stays private until you and another attendee both consent to share contact info.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={applyAction} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">First name</Label>
                  <Input id="first_name" name="first_name" required maxLength={80} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input id="last_name" name="last_name" required maxLength={80} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" name="phone" type="tel" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" name="age" type="number" min={18} max={120} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gender">Gender</Label>
                  <Input id="gender" name="gender" placeholder="Self-describe" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="interested_in">Interested in</Label>
                  <Input id="interested_in" name="interested_in" placeholder="men / women / everyone" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="relationship_goal">Looking for</Label>
                  <Input id="relationship_goal" name="relationship_goal" placeholder="Dating, friendship…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="preferred_age_min">Preferred min age</Label>
                  <Input id="preferred_age_min" name="preferred_age_min" type="number" min={18} max={120} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="preferred_age_max">Preferred max age</Label>
                  <Input id="preferred_age_max" name="preferred_age_max" type="number" min={18} max={120} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Short bio</Label>
                <Textarea id="bio" name="bio" maxLength={1500} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hobbies">Hobbies</Label>
                <Textarea id="hobbies" name="hobbies" maxLength={500} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conversation_topics">Topics you love discussing</Label>
                <Textarea id="conversation_topics" name="conversation_topics" maxLength={500} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dealbreakers">Dealbreakers (optional)</Label>
                <Textarea id="dealbreakers" name="dealbreakers" maxLength={500} rows={2} />
              </div>
              {questions.length > 0 && (
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-sm font-medium">A few more questions from your host</p>
                  {questions.map((q) => {
                    const fieldName = `q_${q.id}`;
                    const opts = (q.options as string[] | null) ?? [];
                    if (q.type === 'textarea') {
                      return (
                        <div key={q.id} className="space-y-1.5">
                          <Label htmlFor={fieldName}>{q.question}{q.required && ' *'}</Label>
                          <Textarea id={fieldName} name={fieldName} required={q.required} rows={3} maxLength={2000} />
                        </div>
                      );
                    }
                    if (q.type === 'select') {
                      return (
                        <div key={q.id} className="space-y-1.5">
                          <Label htmlFor={fieldName}>{q.question}{q.required && ' *'}</Label>
                          <select
                            id={fieldName}
                            name={fieldName}
                            required={q.required}
                            defaultValue=""
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="" disabled>Choose…</option>
                            {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      );
                    }
                    if (q.type === 'multi_select') {
                      return (
                        <div key={q.id} className="space-y-1.5">
                          <Label>{q.question}{q.required && ' *'}</Label>
                          <div className="grid gap-1">
                            {opts.map((o) => (
                              <label key={o} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" name={fieldName} value={o} /> {o}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={q.id} className="space-y-1.5">
                        <Label htmlFor={fieldName}>{q.question}{q.required && ' *'}</Label>
                        <Input id={fieldName} name={fieldName} required={q.required} maxLength={500} />
                      </div>
                    );
                  })}
                </div>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="consent_to_contact" className="mt-0.5" />
                <span>I consent to the host emailing me about this event and follow-ups.</span>
              </label>
              {sp.error && <p className="text-sm text-destructive">{sp.error}</p>}
              <Button type="submit" className="w-full">Submit application</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
