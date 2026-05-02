import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { checkInAttendee, findAttendeeByToken } from '@/lib/services/attendees';

export default async function CheckInPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const { token } = await params;
  const { confirmed } = await searchParams;
  const attendee = await findAttendeeByToken(token);
  if (!attendee) notFound();

  async function confirmCheckIn() {
    'use server';
    const result = await checkInAttendee({ token });
    if (!result.ok) redirect(`/check-in/${token}`);
    redirect(`/check-in/${token}?confirmed=1`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 flex items-center justify-center container-px py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{confirmed ? "You're checked in!" : 'Check in'}</CardTitle>
          <CardDescription>
            {confirmed
              ? `Welcome, ${attendee.first_name}. Your host has been notified.`
              : `Hi ${attendee.first_name}, tap below to check in.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!confirmed ? (
            attendee.status !== 'approved' ? (
              <p className="text-sm text-muted-foreground">
                Your application is currently <span className="font-medium">{attendee.status}</span>. Please contact the host if you think this is an error.
              </p>
            ) : (
              <form action={confirmCheckIn}>
                <Button type="submit" className="w-full">Confirm check-in</Button>
              </form>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              You&apos;ll see your table assignment here once the event begins. Keep this page open.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
