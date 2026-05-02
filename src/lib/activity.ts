// Server-side activity event recorder.
// Realtime subscribers (host dashboard, live event page) listen on
// activity_events filtered by organization_id / event_id.
//
// Sensitive payloads (emails, phone numbers, AI summaries with PII) MUST NOT
// be put into metadata; only IDs and counts.

import { createServiceClient } from '@/lib/supabase/server';

export type ActivityEventType =
  | 'EVENT_CREATED'
  | 'EVENT_PUBLISHED'
  | 'ATTENDEE_APPLIED'
  | 'ATTENDEE_APPROVED'
  | 'ATTENDEE_CHECKED_IN'
  | 'ROUND_SCHEDULE_GENERATED'
  | 'ROUND_STARTED'
  | 'ROUND_ENDED'
  | 'EVENT_STARTED'
  | 'EVENT_ENDED'
  | 'INTEREST_SUBMITTED'
  | 'MUTUAL_MATCH_CREATED'
  | 'INTRO_EMAIL_SENT'
  | 'SUBSCRIPTION_CHANGED'
  | 'USAGE_LIMIT_REACHED'
  | 'AI_MATCHING_RUN';

export interface CreateActivityEventInput {
  organizationId: string;
  eventId?: string | null;
  actorType?: 'host' | 'attendee' | 'system';
  actorId?: string | null;
  eventType: ActivityEventType;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const createActivityEvent = async (input: CreateActivityEventInput) => {
  const supabase = createServiceClient();
  const { error } = await supabase.from('activity_events').insert({
    organization_id: input.organizationId,
    event_id: input.eventId ?? null,
    actor_type: input.actorType ?? 'system',
    actor_id: input.actorId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: (input.metadata as never) ?? null,
  });
  if (error) {
    // Activity logging should never break business flows; surface in server logs.
    console.error('[activity] insert failed', error.message);
  }
};
