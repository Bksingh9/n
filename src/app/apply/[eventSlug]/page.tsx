import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createServiceClient } from '@/lib/supabase/server';
import { ApplicationSchema, applyToEvent } from '@/lib/services/attendees';
import { sendApplicationReceived } from '@/lib/email/send';

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

  async function applyAction(formData: FormData) {
    'use server';
    const raw = Object.fromEntries(formData);
    const parsed = ApplicationSchema.safeParse(raw);
    if (!parsed.success) {
      redirect(`/apply/${eventSlug}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
    }
    const res = await applyToEvent({ eventSlug, input: parsed.data });
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
