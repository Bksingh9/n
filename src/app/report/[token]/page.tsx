import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createServiceClient } from '@/lib/supabase/server';
import { findAttendeeByToken } from '@/lib/services/attendees';
import { SafetyCategories, SafetyReportSchema, reportSafetyConcern } from '@/lib/services/safety';

const labels: Record<string, string> = {
  harassment: 'Harassment or unwanted advances',
  misrepresentation: 'Someone misrepresented who they are',
  unsafe_behavior: 'Unsafe or aggressive behavior',
  venue_concern: 'Venue or accessibility concern',
  other: 'Other',
};

export default async function ReportPage({
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
    .select('id, first_name, last_name')
    .eq('event_id', me.event_id)
    .neq('id', me.id);

  async function submit(formData: FormData) {
    'use server';
    const parsed = SafetyReportSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(`/report/${token}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
    }
    const r = await reportSafetyConcern({ reporterToken: token, input: parsed.data });
    if (!r.ok) redirect(`/report/${token}?error=${encodeURIComponent(r.error ?? '')}`);
    redirect(`/report/${token}?submitted=1`);
  }

  if (sp.submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 flex items-center justify-center container-px py-12">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Report submitted</CardTitle>
            <CardDescription>
              Thank you. Your host has been notified and will review confidentially. If you&apos;re in immediate danger, please contact local emergency services.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 container-px py-8">
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Report a safety concern</CardTitle>
            <CardDescription>
              Reports go directly to the event host. Only your host (and admins on the workspace) can read them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  defaultValue="harassment"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {SafetyCategories.map((c) => (
                    <option key={c} value={c}>{labels[c]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reported_attendee_id">Person involved (optional)</Label>
                <select
                  id="reported_attendee_id"
                  name="reported_attendee_id"
                  defaultValue=""
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Not specific to a person —</option>
                  {(others ?? []).map((o) => (
                    <option key={o.id} value={o.id}>{o.first_name} {(o.last_name ?? '')[0] ? `${(o.last_name ?? '')[0]}.` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="details">What happened?</Label>
                <Textarea id="details" name="details" rows={5} required maxLength={2000} />
              </div>
              {sp.error && <p className="text-sm text-destructive">{sp.error}</p>}
              <Button type="submit" className="w-full">Send to host</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
