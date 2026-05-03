import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requireOrg } from '@/lib/auth';
import { isAtLeast, planFeatures } from '@/lib/roles';
import type { PlanId } from '@/lib/plans';
import { createServiceClient } from '@/lib/supabase/server';
import { InviteSchema, createInvite, listInvites, revokeInvite } from '@/lib/services/invites';
import { sendTeamInvite } from '@/lib/email/send';
import { publicEnv } from '@/lib/env';
import { formatDate } from '@/lib/utils';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const features = planFeatures(ctx.plan as PlanId);
  const svc = createServiceClient();

  const { data: members } = await svc
    .from('organization_members')
    .select('id, user_id, role, created_at')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: true });

  const ids = (members ?? []).map((m) => m.user_id);
  const profiles = new Map<string, { email: string | null; full_name: string | null }>();
  if (ids.length > 0) {
    const { data } = await svc.from('profiles').select('id, email, full_name').in('id', ids);
    (data ?? []).forEach((p) => profiles.set(p.id, { email: p.email, full_name: p.full_name }));
  }

  const invites = features.teamInvites ? await listInvites(ctx.organizationId) : [];
  const pendingInvites = invites.filter((i) => i.status === 'pending');

  async function inviteAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    if (!isAtLeast(c.role, 'admin')) redirect('/app/team?error=Insufficient+role');
    const f = planFeatures(c.plan as PlanId);
    if (!f.teamInvites) redirect('/app/team?error=Plan+does+not+support+team+invites');
    const parsed = InviteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) redirect(`/app/team?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
    const r = await createInvite({
      organizationId: c.organizationId,
      inviterUserId: c.user.id,
      input: parsed.data,
    });
    if (!r.ok) redirect(`/app/team?error=${encodeURIComponent(r.error)}`);
    const acceptUrl = `${publicEnv.APP_URL}/invites/${r.token}`;
    void sendTeamInvite({
      organizationId: c.organizationId,
      organizationName: c.organizationName,
      inviterName: c.user.fullName ?? c.user.email ?? 'A teammate',
      recipientEmail: parsed.data.email,
      role: parsed.data.role,
      acceptUrl,
    });
    redirect('/app/team?sent=1');
  }

  async function revokeAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    if (!isAtLeast(c.role, 'admin')) redirect('/app/team?error=Insufficient+role');
    const inviteId = formData.get('invite_id')?.toString();
    if (!inviteId) redirect('/app/team');
    await revokeInvite({ organizationId: c.organizationId, inviteId });
    redirect('/app/team');
  }

  return (
    <div className="container-px py-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-muted-foreground">Invite teammates and manage roles. Only owners + admins can invite.</p>
      </div>
      {sp.sent && <p className="text-sm text-emerald-700">Invite email sent.</p>}
      {sp.error && <p className="text-sm text-destructive">{sp.error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>{members?.length ?? 0} active</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(members ?? []).map((m) => {
              const p = profiles.get(m.user_id);
              return (
                <li key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <div className="font-medium">{p?.full_name || p?.email || m.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{p?.email}</div>
                  </div>
                  <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {features.teamInvites ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>They&apos;ll receive an email with a one-click accept link (expires in 14 days).</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={inviteAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <select id="role" name="role" defaultValue="member" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <Button type="submit">Send invite</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Team invites</CardTitle>
            <CardDescription>Available on Pro and Agency plans.</CardDescription>
          </CardHeader>
          <CardContent><Button asChild><a href="/app/billing">Upgrade plan</a></Button></CardContent>
        </Card>
      )}

      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invites ({pendingInvites.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {pendingInvites.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{i.email}</div>
                    <div className="text-xs text-muted-foreground">expires {formatDate(i.expires_at)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">{i.role}</Badge>
                    <form action={revokeAction}>
                      <input type="hidden" name="invite_id" value={i.id} />
                      <Button size="sm" variant="ghost" type="submit">Revoke</Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
