import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSessionUser } from '@/lib/auth';
import { acceptInvite } from '@/lib/services/invites';
import { createServiceClient } from '@/lib/supabase/server';
import { hashToken } from '@/lib/utils';

export default async function InviteAcceptPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const user = await getSessionUser();

  // Look up invite to surface helpful messaging without consuming the token.
  const svc = createServiceClient();
  const tokenHash = await hashToken(token);
  const { data: invite } = await svc
    .from('organization_invites')
    .select('id, email, role, status, expires_at, organization_id')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!invite) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 flex items-center justify-center container-px py-12">
        <Card className="max-w-md w-full"><CardHeader>
          <CardTitle>Invite not found</CardTitle>
          <CardDescription>This link is invalid or has already been used.</CardDescription>
        </CardHeader></Card>
      </div>
    );
  }

  if (invite.status !== 'pending' || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 flex items-center justify-center container-px py-12">
        <Card className="max-w-md w-full"><CardHeader>
          <CardTitle>Invite no longer active</CardTitle>
          <CardDescription>Ask the inviter to send a new one.</CardDescription>
        </CardHeader></Card>
      </div>
    );
  }

  const { data: org } = await svc.from('organizations').select('name').eq('id', invite.organization_id).single();

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 flex items-center justify-center container-px py-12">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Join {org?.name}</CardTitle>
            <CardDescription>Sign in or create an account with <strong>{invite.email}</strong> to accept this invite.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild><Link href={`/sign-up?next=${encodeURIComponent(`/invites/${token}`)}`}>Create account</Link></Button>
            <Button asChild variant="outline"><Link href={`/sign-in?next=${encodeURIComponent(`/invites/${token}`)}`}>Sign in</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 flex items-center justify-center container-px py-12">
        <Card className="max-w-md w-full"><CardHeader>
          <CardTitle>Wrong account</CardTitle>
          <CardDescription>
            This invite is for <strong>{invite.email}</strong>, but you&apos;re signed in as <strong>{user.email}</strong>. Sign out and sign back in with the invited email.
          </CardDescription>
        </CardHeader></Card>
      </div>
    );
  }

  async function acceptAction() {
    'use server';
    const u = await getSessionUser();
    if (!u || !u.email) redirect(`/invites/${token}?error=Not+signed+in`);
    const r = await acceptInvite({ token, userId: u!.id, userEmail: u!.email! });
    if (!r.ok) redirect(`/invites/${token}?error=${encodeURIComponent(r.error)}`);
    redirect('/app');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 flex items-center justify-center container-px py-12">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Join {org?.name}</CardTitle>
          <CardDescription>You&apos;ve been invited as <strong>{invite.role}</strong>.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={acceptAction}>
            <Button type="submit" className="w-full">Accept invite</Button>
          </form>
          {sp.error && <p className="mt-3 text-sm text-destructive">{sp.error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
