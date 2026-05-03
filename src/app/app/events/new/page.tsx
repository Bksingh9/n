import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { requireOrg } from '@/lib/auth';
import { CreateEventSchema, createEvent } from '@/lib/services/events';
import { listBrands } from '@/lib/services/brands';
import { planFeatures } from '@/lib/roles';
import type { PlanId } from '@/lib/plans';

async function createEventAction(formData: FormData) {
  'use server';
  const ctx = await requireOrg();
  const parsed = CreateEventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/app/events/new?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const result = await createEvent({
    organizationId: ctx.organizationId,
    userId: ctx.user.id,
    input: parsed.data,
  });
  if (!result.ok) {
    const err = result.error === 'PLAN_LIMIT' ? 'You hit your plan limit. Upgrade to add more events.' : (result.error ?? 'Could not create event');
    redirect(`/app/events/new?error=${encodeURIComponent(err)}`);
  }
  redirect(`/app/events/${result.eventId}`);
}

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await requireOrg();
  const features = planFeatures(ctx.plan as PlanId);
  const brands = features.multipleBrands ? await listBrands(ctx.organizationId) : [];
  const params = await searchParams;
  return (
    <div className="container-px py-8 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create a new event</CardTitle>
          <CardDescription>You can add custom application questions after creating the event.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createEventAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" maxLength={4000} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="event_type">Event type</Label>
                <Input id="event_type" name="event_type" placeholder="Speed dating, mixer, brunch…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="relationship_goal">Relationship goal</Label>
                <Input id="relationship_goal" name="relationship_goal" placeholder="Dating, friendship, both" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venue_name">Venue name</Label>
                <Input id="venue_name" name="venue_name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="starts_at">Starts at</Label>
                <Input id="starts_at" name="starts_at" type="datetime-local" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ends_at">Ends at</Label>
                <Input id="ends_at" name="ends_at" type="datetime-local" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age_min">Min age</Label>
                <Input id="age_min" name="age_min" type="number" min={18} max={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age_max">Max age</Label>
                <Input id="age_max" name="age_max" type="number" min={18} max={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_attendees">Max attendees</Label>
                <Input id="max_attendees" name="max_attendees" type="number" min={2} max={2000} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="application_deadline">Application deadline</Label>
                <Input id="application_deadline" name="application_deadline" type="datetime-local" />
              </div>
              {features.multipleBrands && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="brand_id">Brand</Label>
                  <select
                    id="brand_id"
                    name="brand_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— Default brand —</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {params.error && <p className="text-sm text-destructive">{params.error}</p>}
            <Button type="submit" className="w-full">Create event</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
