// Coordinates compatibility scoring + rotation generation.

import { createServiceClient } from '@/lib/supabase/server';
import { createActivityEvent } from '@/lib/activity';
import { enforceUsage, recordUsage } from '@/lib/usage';
import { computeDeterministicScore } from '@/lib/matching/scoring';
import { generateCompatibilityScore } from '@/lib/matching/anthropic';
import { buildCompatLookup, generateRotations, type RotationOptions } from '@/lib/matching/rotation';

export interface RunMatchingOptions {
  organizationId: string;
  userId: string;
  eventId: string;
  useAi: boolean;
}

export const runMatching = async (params: RunMatchingOptions) => {
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id, title, relationship_goal, organization_id')
    .eq('id', params.eventId)
    .eq('organization_id', params.organizationId)
    .maybeSingle();
  if (!event) return { ok: false as const, error: 'Event not found' };

  const { data: attendees } = await svc
    .from('attendees')
    .select('id, first_name, age, gender, interested_in, relationship_goal, preferred_age_min, preferred_age_max, hobbies, conversation_topics')
    .eq('event_id', params.eventId)
    .eq('status', 'approved');
  if (!attendees || attendees.length < 2) {
    return { ok: false as const, error: 'Need at least 2 approved attendees' };
  }

  if (params.useAi) {
    const usage = await enforceUsage(params.organizationId, 'ai_matching_runs', 1);
    if (!usage.allowed) {
      return { ok: false as const, error: 'AI matching limit reached for your plan' };
    }
  }

  const rows: Array<{
    organization_id: string;
    event_id: string;
    attendee_a_id: string;
    attendee_b_id: string;
    score: number;
    summary: string | null;
    reasons: string[];
    preference_conflict: boolean;
  }> = [];

  for (let i = 0; i < attendees.length; i++) {
    for (let j = i + 1; j < attendees.length; j++) {
      const a = attendees[i];
      const b = attendees[j];
      let result;
      if (params.useAi) {
        result = await generateCompatibilityScore(a, b, { title: event.title, relationship_goal: event.relationship_goal });
      } else {
        const det = computeDeterministicScore(a, b);
        result = {
          score: det.score,
          reasons: det.reasons,
          preference_conflict: det.preference_conflict,
          summary: det.preference_conflict ? 'Preferences conflict.' : 'Reasonable conversational fit.',
          host_note: '',
        };
      }
      rows.push({
        organization_id: params.organizationId,
        event_id: params.eventId,
        attendee_a_id: a.id < b.id ? a.id : b.id,
        attendee_b_id: a.id < b.id ? b.id : a.id,
        score: result.score,
        summary: result.summary ?? null,
        reasons: result.reasons,
        preference_conflict: result.preference_conflict,
      });
    }
  }

  await svc.from('compatibility_scores').delete().eq('event_id', params.eventId);
  if (rows.length > 0) {
    await svc.from('compatibility_scores').insert(
      rows.map((r) => ({
        organization_id: r.organization_id,
        event_id: r.event_id,
        attendee_a_id: r.attendee_a_id,
        attendee_b_id: r.attendee_b_id,
        score: r.score,
        summary: r.summary,
        reasons: r.reasons as never,
        preference_conflict: r.preference_conflict,
      })),
    );
  }

  if (params.useAi) {
    await recordUsage(params.organizationId, 'ai_matching_runs', { userId: params.userId });
    await createActivityEvent({
      organizationId: params.organizationId,
      eventId: params.eventId,
      actorType: 'host',
      actorId: params.userId,
      eventType: 'AI_MATCHING_RUN',
      metadata: { pairs: rows.length },
    });
  }

  return { ok: true as const, pairs: rows.length };
};

export const generateAndSaveRotations = async (params: {
  organizationId: string;
  userId: string;
  eventId: string;
  options: Omit<RotationOptions, 'start_time'> & { start_time?: string };
}) => {
  const svc = createServiceClient();
  const { data: attendees } = await svc
    .from('attendees')
    .select('id, gender, interested_in')
    .eq('event_id', params.eventId)
    .eq('status', 'approved')
    .eq('checked_in', true);
  if (!attendees || attendees.length < 2) {
    return { ok: false as const, error: 'Need at least 2 checked-in attendees' };
  }
  const { data: scores } = await svc
    .from('compatibility_scores')
    .select('attendee_a_id, attendee_b_id, score, preference_conflict')
    .eq('event_id', params.eventId);

  const lookup = buildCompatLookup(scores ?? []);
  const opts: RotationOptions = {
    ...params.options,
    start_time: params.options.start_time ? new Date(params.options.start_time) : new Date(),
  };
  const rounds = generateRotations(attendees, opts, lookup);

  // Replace existing rotations for the event.
  await svc.from('rotation_rounds').delete().eq('event_id', params.eventId);
  if (rounds.length > 0) {
    await svc.from('rotation_rounds').insert(
      rounds.map((r) => ({
        organization_id: params.organizationId,
        event_id: params.eventId,
        round_number: r.round_number,
        table_number: r.table_number,
        attendee_a_id: r.attendee_a_id,
        attendee_b_id: r.attendee_b_id,
        starts_at: r.starts_at.toISOString(),
        ends_at: r.ends_at.toISOString(),
        status: r.status,
      })),
    );
  }

  await createActivityEvent({
    organizationId: params.organizationId,
    eventId: params.eventId,
    actorType: 'host',
    actorId: params.userId,
    eventType: 'ROUND_SCHEDULE_GENERATED',
    metadata: { rounds: opts.round_count, pairs: rounds.length },
  });

  return { ok: true as const, count: rounds.length };
};
