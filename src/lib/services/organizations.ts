// Organization lifecycle.

import { createServiceClient } from '@/lib/supabase/server';
import { createActivityEvent } from '@/lib/activity';
import { slugify } from '@/lib/utils';

export interface CreateOrganizationInput {
  userId: string;
  userEmail: string | null;
  organizationName: string;
  hostName?: string;
  city?: string;
  contactEmail?: string;
  eventType?: string;
  brandTone?: string;
}

export const createOrganizationForUser = async (input: CreateOrganizationInput) => {
  const svc = createServiceClient();

  const baseSlug = slugify(input.organizationName) || 'team';
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  const { data: org, error } = await svc
    .from('organizations')
    .insert({
      name: input.organizationName,
      slug,
      plan: 'free',
      city: input.city ?? null,
      contact_email: input.contactEmail ?? input.userEmail ?? null,
      event_type: input.eventType ?? null,
      brand_tone: input.brandTone ?? null,
    })
    .select('id, name, plan')
    .single();
  if (error || !org) throw new Error(error?.message ?? 'Failed to create organization');

  const { error: memberErr } = await svc.from('organization_members').insert({
    organization_id: org.id,
    user_id: input.userId,
    role: 'owner',
  });
  if (memberErr) throw new Error(memberErr.message);

  if (input.hostName) {
    await svc
      .from('profiles')
      .update({ full_name: input.hostName })
      .eq('id', input.userId);
  }

  await createActivityEvent({
    organizationId: org.id,
    actorType: 'host',
    actorId: input.userId,
    eventType: 'EVENT_CREATED',
    entityType: 'organization',
    entityId: org.id,
    metadata: { kind: 'org_created' },
  });

  return org;
};
