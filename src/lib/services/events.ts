// Event lifecycle. All writes go through here so that activity events
// and usage tracking are consistent.

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { createActivityEvent } from '@/lib/activity';
import { enforceUsage, recordUsage } from '@/lib/usage';
import { slugify } from '@/lib/utils';

export const CreateEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  event_type: z.string().max(80).optional(),
  venue_name: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  age_min: z.coerce.number().int().min(18).max(120).optional(),
  age_max: z.coerce.number().int().min(18).max(120).optional(),
  max_attendees: z.coerce.number().int().min(2).max(2000).optional(),
  application_deadline: z.string().optional(),
  relationship_goal: z.string().max(120).optional(),
  brand_id: z.string().uuid().optional().or(z.literal('')),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const createEvent = async (params: {
  organizationId: string;
  userId: string;
  input: CreateEventInput;
}) => {
  const usage = await enforceUsage(params.organizationId, 'events_created', 1);
  if (!usage.allowed) {
    return { ok: false as const, error: 'PLAN_LIMIT', usage };
  }

  const svc = createServiceClient();
  const baseSlug = slugify(params.input.title) || 'event';
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await svc
    .from('events')
    .insert({
      organization_id: params.organizationId,
      host_id: params.userId,
      title: params.input.title,
      description: params.input.description ?? null,
      event_type: params.input.event_type ?? null,
      venue_name: params.input.venue_name ?? null,
      city: params.input.city ?? null,
      starts_at: params.input.starts_at,
      ends_at: params.input.ends_at,
      status: 'draft',
      public_slug: slug,
      age_min: params.input.age_min ?? null,
      age_max: params.input.age_max ?? null,
      max_attendees: params.input.max_attendees ?? null,
      application_deadline: params.input.application_deadline || null,
      relationship_goal: params.input.relationship_goal ?? null,
      brand_id: params.input.brand_id || null,
    })
    .select('id, public_slug')
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? 'Failed to create event' };

  await Promise.all([
    recordUsage(params.organizationId, 'events_created', { userId: params.userId }),
    createActivityEvent({
      organizationId: params.organizationId,
      eventId: data.id,
      actorType: 'host',
      actorId: params.userId,
      eventType: 'EVENT_CREATED',
      entityType: 'event',
      entityId: data.id,
    }),
  ]);

  return { ok: true as const, eventId: data.id, slug: data.public_slug };
};

export const publishEvent = async (params: {
  organizationId: string;
  userId: string;
  eventId: string;
}) => {
  const svc = createServiceClient();
  const { error } = await svc
    .from('events')
    .update({ status: 'published' })
    .eq('id', params.eventId)
    .eq('organization_id', params.organizationId);
  if (error) return { ok: false as const, error: error.message };
  await createActivityEvent({
    organizationId: params.organizationId,
    eventId: params.eventId,
    actorType: 'host',
    actorId: params.userId,
    eventType: 'EVENT_PUBLISHED',
    entityType: 'event',
    entityId: params.eventId,
  });
  return { ok: true as const };
};
