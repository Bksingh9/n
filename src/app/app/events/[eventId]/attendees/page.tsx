import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { setAttendeeStatus } from '@/lib/services/attendees';
import { planFeatures } from '@/lib/roles';
import type { PlanId } from '@/lib/plans';

export default async function AttendeesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await requireOrg();
  const { eventId } = await params;
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (!event) notFound();
  const { data: attendees } = await svc
    .from('attendees')
    .select('id, first_name, last_name, email, age, gender, interested_in, status, checked_in')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  async function changeStatus(formData: FormData) {
    'use server';
    const c = await requireOrg();
    const attendeeId = formData.get('attendee_id')?.toString() ?? '';
    const status = formData.get('status')?.toString() as 'approved' | 'declined' | 'waitlist';
    if (!attendeeId || !status) return;
    await setAttendeeStatus({ organizationId: c.organizationId, userId: c.user.id, attendeeId, status });
    redirect(`/app/events/${eventId}/attendees`);
  }

  const features = planFeatures(ctx.plan as PlanId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Attendees ({attendees?.length ?? 0})</span>
          {features.csvExport && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/api/events/${eventId}/export?kind=attendees`}>Export CSV</Link>
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!attendees || attendees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet. Share your apply link to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Age</th>
                  <th className="py-2 pr-4">Looking for</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Check-in</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/app/events/${eventId}/attendees/${a.id}`} className="font-medium hover:underline">
                        {a.first_name} {a.last_name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{a.email}</div>
                    </td>
                    <td className="py-2 pr-4">{a.age ?? '—'}</td>
                    <td className="py-2 pr-4 capitalize">{a.interested_in ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="secondary" className="capitalize">{a.status}</Badge>
                    </td>
                    <td className="py-2 pr-4">{a.checked_in ? <Badge variant="success">In</Badge> : '—'}</td>
                    <td className="py-2 pr-4">
                      <form action={changeStatus} className="flex gap-1">
                        <input type="hidden" name="attendee_id" value={a.id} />
                        {a.status !== 'approved' && (
                          <Button size="sm" name="status" value="approved" type="submit">Approve</Button>
                        )}
                        {a.status !== 'waitlist' && (
                          <Button size="sm" variant="outline" name="status" value="waitlist" type="submit">Waitlist</Button>
                        )}
                        {a.status !== 'declined' && (
                          <Button size="sm" variant="ghost" name="status" value="declined" type="submit">Decline</Button>
                        )}
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
