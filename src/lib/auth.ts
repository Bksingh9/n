// Server-side auth + organization helpers used by Server Components and
// route handlers. Keeps every page free of repetitive boilerplate while
// guaranteeing tenant scoping.

import { redirect } from 'next/navigation';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string | null;
}

export interface OrgContext {
  user: SessionUser;
  organizationId: string;
  organizationName: string;
  role: string;
  plan: string;
}

export const getSessionUser = async (): Promise<SessionUser | null> => {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    fullName: (data.user.user_metadata?.full_name as string | undefined) ?? null,
  };
};

export const requireUser = async (): Promise<SessionUser> => {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  return user;
};

export const getOrgContext = async (): Promise<OrgContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  // Use service role to read membership reliably regardless of RLS recursion.
  const svc = createServiceClient();
  const { data: member } = await svc
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!member) return null;
  const { data: org } = await svc
    .from('organizations')
    .select('id, name, plan')
    .eq('id', member.organization_id)
    .single();
  if (!org) return null;
  return {
    user,
    organizationId: org.id,
    organizationName: org.name,
    role: member.role,
    plan: org.plan,
  };
};

export const requireOrg = async (): Promise<OrgContext> => {
  const user = await requireUser();
  const ctx = await getOrgContext();
  if (!ctx) redirect('/onboarding');
  return { ...ctx, user };
};
