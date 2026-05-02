import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getOrgContext, requireUser } from '@/lib/auth';
import { createOrganizationForUser } from '@/lib/services/organizations';
import { z } from 'zod';

const Schema = z.object({
  organization_name: z.string().min(1).max(120),
  host_name: z.string().min(1).max(120).optional(),
  city: z.string().max(80).optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  event_type: z.string().max(80).optional(),
  brand_tone: z.string().max(280).optional(),
});

async function onboardAction(formData: FormData) {
  'use server';
  const user = await requireUser();
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/onboarding?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  await createOrganizationForUser({
    userId: user.id,
    userEmail: user.email,
    organizationName: parsed.data.organization_name,
    hostName: parsed.data.host_name,
    city: parsed.data.city,
    contactEmail: parsed.data.contact_email || undefined,
    eventType: parsed.data.event_type,
    brandTone: parsed.data.brand_tone,
  });
  redirect('/app');
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const existing = await getOrgContext();
  if (existing) redirect('/app');
  const params = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/40 px-4 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Tell us about your hosting</CardTitle>
          <CardDescription>
            We&apos;ll set up your DateOps Live workspace with sensible defaults you can adjust anytime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={onboardAction} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="host_name">Your name</Label>
                <Input id="host_name" name="host_name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="organization_name">Organization name</Label>
                <Input id="organization_name" name="organization_name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" placeholder="Brooklyn" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_email">Contact email</Label>
                <Input id="contact_email" name="contact_email" type="email" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="event_type">Event type</Label>
                <Input id="event_type" name="event_type" placeholder="Speed dating, mixers, matchmaker brunch…" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="brand_tone">Brand tone</Label>
                <Textarea id="brand_tone" name="brand_tone" placeholder="Warm, witty, professional…" />
              </div>
            </div>
            {params.error && <p className="text-sm text-destructive">{params.error}</p>}
            <Button type="submit" className="w-full">Create workspace</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
