// Post-event flow: an attendee reaches their post-event page via a private
// token; they pick people they want to meet again and choose to consent to
// share contact info. Mutual matches are detected; intro emails fire only
// when both attendees consented to share contact.

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { createActivityEvent } from '@/lib/activity';
import { findAttendeeByToken } from '@/lib/services/attendees';
import { sendIntroEmail } from '@/lib/email/send';
import { enqueueJob } from '@/lib/services/jobs';
import { checkRateLimit } from '@/lib/rate-limit';

export const InterestSchema = z.object({
  to_attendee_id: z.string().uuid(),
  interest_type: z.enum(['romantic', 'friendship', 'professional']),
  consent_to_share_contact: z
    .union([z.literal('on'), z.literal('true'), z.boolean()])
    .optional()
    .transform((v) => v === 'on' || v === 'true' || v === true),
});

export type InterestInput = z.infer<typeof InterestSchema>;

export const submitInterest = async (token: string, input: InterestInput) => {
  const me = await findAttendeeByToken(token);
  if (!me) return { ok: false as const, error: 'Invalid link' };
  if (input.to_attendee_id === me.id) return { ok: false as const, error: 'Cannot select yourself' };

  // Cap to 60 interest submissions / hour per attendee. A typical event
  // is dozens of attendees; this catches scripted abuse without blocking
  // a legitimate run through the post-event list.
  const limit = await checkRateLimit({
    action: 'post_event_interest',
    identifier: me.id,
    limit: 60,
    windowMs: 60 * 60_000,
  });
  if (!limit.allowed) {
    return { ok: false as const, error: 'You are submitting too quickly. Try again shortly.' };
  }

  const svc = createServiceClient();
  const { data: target } = await svc
    .from('attendees')
    .select('id, event_id, organization_id')
    .eq('id', input.to_attendee_id)
    .eq('event_id', me.event_id)
    .maybeSingle();
  if (!target) return { ok: false as const, error: 'Attendee not found at this event' };

  await svc
    .from('post_event_interests')
    .upsert(
      {
        organization_id: me.organization_id,
        event_id: me.event_id,
        from_attendee_id: me.id,
        to_attendee_id: input.to_attendee_id,
        interest_type: input.interest_type,
        consent_to_share_contact: input.consent_to_share_contact ?? false,
      },
      { onConflict: 'event_id,from_attendee_id,to_attendee_id' },
    );

  await createActivityEvent({
    organizationId: me.organization_id,
    eventId: me.event_id,
    actorType: 'attendee',
    actorId: me.id,
    eventType: 'INTEREST_SUBMITTED',
    entityType: 'attendee',
    entityId: input.to_attendee_id,
    metadata: { interest_type: input.interest_type },
  });

  // Detect mutual matches
  await detectMutualMatch({
    organizationId: me.organization_id,
    eventId: me.event_id,
    aId: me.id,
    bId: input.to_attendee_id,
  });

  return { ok: true as const };
};

export const detectMutualMatch = async (params: {
  organizationId: string;
  eventId: string;
  aId: string;
  bId: string;
}) => {
  const svc = createServiceClient();
  const [aId, bId] = [params.aId, params.bId].sort();
  const { data: rows } = await svc
    .from('post_event_interests')
    .select('from_attendee_id, to_attendee_id, interest_type, consent_to_share_contact')
    .eq('event_id', params.eventId)
    .or(
      `and(from_attendee_id.eq.${aId},to_attendee_id.eq.${bId}),and(from_attendee_id.eq.${bId},to_attendee_id.eq.${aId})`,
    );
  if (!rows || rows.length < 2) return { matched: false as const };
  const aToB = rows.find((r) => r.from_attendee_id === aId && r.to_attendee_id === bId);
  const bToA = rows.find((r) => r.from_attendee_id === bId && r.to_attendee_id === aId);
  if (!aToB || !bToA) return { matched: false as const };

  const matchType = aToB.interest_type === bToA.interest_type ? aToB.interest_type : 'mixed';
  const { data: existing } = await svc
    .from('mutual_matches')
    .select('id, intro_email_sent')
    .eq('event_id', params.eventId)
    .eq('attendee_a_id', aId)
    .eq('attendee_b_id', bId)
    .maybeSingle();

  let matchId = existing?.id ?? null;
  if (!matchId) {
    const { data: created } = await svc
      .from('mutual_matches')
      .insert({
        organization_id: params.organizationId,
        event_id: params.eventId,
        attendee_a_id: aId,
        attendee_b_id: bId,
        match_type: matchType,
      })
      .select('id')
      .single();
    matchId = created?.id ?? null;
    if (matchId) {
      await createActivityEvent({
        organizationId: params.organizationId,
        eventId: params.eventId,
        eventType: 'MUTUAL_MATCH_CREATED',
        entityType: 'mutual_match',
        entityId: matchId,
        metadata: { match_type: matchType },
      });
    }
  }

  if (matchId && !existing?.intro_email_sent && aToB.consent_to_share_contact && bToA.consent_to_share_contact) {
    // Enqueue rather than send inline so a transient Resend failure is
    // retried automatically and the attendee-facing request stays fast.
    await enqueueJob({
      kind: 'send_intro_for_match',
      organizationId: params.organizationId,
      payload: { match_id: matchId },
    });
  }

  return { matched: true as const };
};

export const sendIntroEmailForMatch = async (matchId: string) => {
  const svc = createServiceClient();
  const { data: match } = await svc
    .from('mutual_matches')
    .select('id, organization_id, event_id, attendee_a_id, attendee_b_id, intro_email_sent')
    .eq('id', matchId)
    .maybeSingle();
  if (!match || match.intro_email_sent) return;

  const { data: attendees } = await svc
    .from('attendees')
    .select('id, first_name, last_name, email, consent_to_contact')
    .in('id', [match.attendee_a_id, match.attendee_b_id]);
  if (!attendees || attendees.length < 2) return;
  const a = attendees.find((x) => x.id === match.attendee_a_id);
  const b = attendees.find((x) => x.id === match.attendee_b_id);
  if (!a || !b || !a.email || !b.email) return;
  if (!a.consent_to_contact || !b.consent_to_contact) return;

  const { data: event } = await svc.from('events').select('title').eq('id', match.event_id).maybeSingle();

  await sendIntroEmail({
    organizationId: match.organization_id,
    eventId: match.event_id,
    eventTitle: event?.title ?? 'your event',
    a: { firstName: a.first_name ?? '', lastName: a.last_name ?? '', email: a.email },
    b: { firstName: b.first_name ?? '', lastName: b.last_name ?? '', email: b.email },
  });

  await svc
    .from('mutual_matches')
    .update({ intro_email_sent: true, intro_email_sent_at: new Date().toISOString() })
    .eq('id', matchId);
  await createActivityEvent({
    organizationId: match.organization_id,
    eventId: match.event_id,
    eventType: 'INTRO_EMAIL_SENT',
    entityType: 'mutual_match',
    entityId: matchId,
  });
};
