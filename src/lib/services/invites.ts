// Team invite lifecycle. Issuance is rate-bounded by enforceUsage on
// team_members_added (counts pending + accepted invites). Acceptance is
// idempotent: same email reaccepting just attaches the user.

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hashToken, randomToken } from '@/lib/utils';
import { enforceUsage, recordUsage } from '@/lib/usage';
import type { OrganizationInviteRow } from '@/lib/supabase/types';

export const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
});

export type InviteInput = z.infer<typeof InviteSchema>;

export const listInvites = async (organizationId: string): Promise<OrganizationInviteRow[]> => {
  const svc = createServiceClient();
  const { data } = await svc
    .from('organization_invites')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  return (data ?? []) as OrganizationInviteRow[];
};

export const createInvite = async (params: {
  organizationId: string;
  inviterUserId: string;
  input: InviteInput;
}): Promise<{ ok: true; invite: OrganizationInviteRow; token: string } | { ok: false; error: string }> => {
  const usage = await enforceUsage(params.organizationId, 'team_members_added', 1);
  if (!usage.allowed) {
    return { ok: false, error: 'Plan team-member limit reached' };
  }

  const svc = createServiceClient();
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const email = params.input.email.toLowerCase();

  // Block re-invites if the email is already a member.
  const { data: profile } = await svc
    .from('profiles')
    .select('id, email')
    .ilike('email', email)
    .maybeSingle();
  if (profile) {
    const { data: existingMember } = await svc
      .from('organization_members')
      .select('id')
      .eq('organization_id', params.organizationId)
      .eq('user_id', profile.id)
      .maybeSingle();
    if (existingMember) return { ok: false, error: 'That user is already a member' };
  }

  const { data, error } = await svc
    .from('organization_invites')
    .upsert(
      {
        organization_id: params.organizationId,
        email,
        role: params.input.role,
        invited_by: params.inviterUserId,
        token_hash: tokenHash,
        status: 'pending',
        accepted_by: null,
        accepted_at: null,
        expires_at: new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
      },
      { onConflict: 'organization_id,email' },
    )
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create invite' };

  await recordUsage(params.organizationId, 'team_members_added', { userId: params.inviterUserId });
  return { ok: true, invite: data as OrganizationInviteRow, token };
};

export const revokeInvite = async (params: { organizationId: string; inviteId: string }) => {
  const svc = createServiceClient();
  const { error } = await svc
    .from('organization_invites')
    .update({ status: 'revoked' })
    .eq('id', params.inviteId)
    .eq('organization_id', params.organizationId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
};

export const acceptInvite = async (params: { token: string; userId: string; userEmail: string }) => {
  const svc = createServiceClient();
  const tokenHash = await hashToken(params.token);
  const { data: invite } = await svc
    .from('organization_invites')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (!invite) return { ok: false as const, error: 'Invalid invite link' };
  const row = invite as OrganizationInviteRow;
  if (row.status !== 'pending') return { ok: false as const, error: 'Invite is no longer active' };
  if (new Date(row.expires_at) < new Date()) {
    await svc.from('organization_invites').update({ status: 'expired' }).eq('id', row.id);
    return { ok: false as const, error: 'Invite expired' };
  }
  if (row.email.toLowerCase() !== params.userEmail.toLowerCase()) {
    return { ok: false as const, error: 'Invite email does not match the signed-in user' };
  }

  // Idempotent attach.
  await svc
    .from('organization_members')
    .upsert(
      { organization_id: row.organization_id, user_id: params.userId, role: row.role },
      { onConflict: 'organization_id,user_id' },
    );

  await svc
    .from('organization_invites')
    .update({ status: 'accepted', accepted_by: params.userId, accepted_at: new Date().toISOString() })
    .eq('id', row.id);

  return { ok: true as const, organizationId: row.organization_id };
};
