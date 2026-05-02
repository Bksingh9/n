// Live event control: start/end event, advance rounds.

import { createServiceClient } from '@/lib/supabase/server';
import { createActivityEvent } from '@/lib/activity';

export const startEvent = async (params: { organizationId: string; userId: string; eventId: string }) => {
  const svc = createServiceClient();
  const { error } = await svc
    .from('events')
    .update({ status: 'live', current_round: 0 })
    .eq('id', params.eventId)
    .eq('organization_id', params.organizationId);
  if (error) return { ok: false as const, error: error.message };
  await createActivityEvent({
    organizationId: params.organizationId,
    eventId: params.eventId,
    actorType: 'host',
    actorId: params.userId,
    eventType: 'EVENT_STARTED',
  });
  return { ok: true as const };
};

export const endEvent = async (params: { organizationId: string; userId: string; eventId: string }) => {
  const svc = createServiceClient();
  const { error } = await svc
    .from('events')
    .update({ status: 'completed', round_started_at: null, round_ends_at: null })
    .eq('id', params.eventId)
    .eq('organization_id', params.organizationId);
  if (error) return { ok: false as const, error: error.message };
  await createActivityEvent({
    organizationId: params.organizationId,
    eventId: params.eventId,
    actorType: 'host',
    actorId: params.userId,
    eventType: 'EVENT_ENDED',
  });
  return { ok: true as const };
};

export const startNextRound = async (params: { organizationId: string; userId: string; eventId: string }) => {
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id, current_round')
    .eq('id', params.eventId)
    .eq('organization_id', params.organizationId)
    .maybeSingle();
  if (!event) return { ok: false as const, error: 'Event not found' };
  const next = (event.current_round ?? 0) + 1;
  const { data: rounds } = await svc
    .from('rotation_rounds')
    .select('id, ends_at, starts_at')
    .eq('event_id', params.eventId)
    .eq('round_number', next)
    .limit(1);
  if (!rounds || rounds.length === 0) return { ok: false as const, error: 'No more rounds scheduled' };
  const startedAt = new Date();
  const endsAt = rounds[0].ends_at && rounds[0].starts_at
    ? new Date(startedAt.getTime() + (new Date(rounds[0].ends_at).getTime() - new Date(rounds[0].starts_at).getTime()))
    : new Date(startedAt.getTime() + 6 * 60_000);
  await svc
    .from('events')
    .update({ current_round: next, round_started_at: startedAt.toISOString(), round_ends_at: endsAt.toISOString() })
    .eq('id', params.eventId);
  await svc.from('rotation_rounds').update({ status: 'active' }).eq('event_id', params.eventId).eq('round_number', next);
  await createActivityEvent({
    organizationId: params.organizationId,
    eventId: params.eventId,
    actorType: 'host',
    actorId: params.userId,
    eventType: 'ROUND_STARTED',
    metadata: { round_number: next },
  });
  return { ok: true as const, round: next };
};

export const endCurrentRound = async (params: { organizationId: string; userId: string; eventId: string }) => {
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('current_round')
    .eq('id', params.eventId)
    .eq('organization_id', params.organizationId)
    .maybeSingle();
  if (!event || !event.current_round) return { ok: false as const, error: 'No active round' };
  await svc
    .from('rotation_rounds')
    .update({ status: 'completed' })
    .eq('event_id', params.eventId)
    .eq('round_number', event.current_round);
  await svc
    .from('events')
    .update({ round_started_at: null, round_ends_at: null })
    .eq('id', params.eventId);
  await createActivityEvent({
    organizationId: params.organizationId,
    eventId: params.eventId,
    actorType: 'host',
    actorId: params.userId,
    eventType: 'ROUND_ENDED',
    metadata: { round_number: event.current_round },
  });
  return { ok: true as const };
};
