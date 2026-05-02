import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const Schema = z.object({
  name: z.string().min(1).max(120),
  city: z.string().max(80).optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  event_type: z.string().max(80).optional(),
  brand_tone: z.string().max(280).optional(),
});

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const svc = createServiceClient();
  const { data: org } = await svc
    .from('organizations')
    .select('name, city, contact_email, event_type, brand_tone')
    .eq('id', ctx.organizationId)
    .single();

  async function saveAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    const parsed = Schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) redirect(`/app/settings?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
    const svc2 = createServiceClient();
    await svc2
      .from('organizations')
      .update({
        name: parsed.data.name,
        city: parsed.data.city ?? null,
        contact_email: parsed.data.contact_email || null,
        event_type: parsed.data.event_type ?? null,
        brand_tone: parsed.data.brand_tone ?? null,
      })
      .eq('id', c.organizationId);
    redirect('/app/settings?saved=1');
  }

  return (
    <div className="container-px py-8 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Organization settings</CardTitle>
          <CardDescription>How DateOps Live presents your brand to attendees.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Organization name</Label>
              <Input id="name" name="name" defaultValue={org?.name ?? ''} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={org?.city ?? ''} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_email">Contact email</Label>
                <Input id="contact_email" name="contact_email" type="email" defaultValue={org?.contact_email ?? ''} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="event_type">Event type</Label>
                <Input id="event_type" name="event_type" defaultValue={org?.event_type ?? ''} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="brand_tone">Brand tone</Label>
                <Textarea id="brand_tone" name="brand_tone" defaultValue={org?.brand_tone ?? ''} />
              </div>
            </div>
            {sp.saved && <p className="text-sm text-emerald-700">Saved.</p>}
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
