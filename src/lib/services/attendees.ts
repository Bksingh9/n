// Attendee operations: applications (public-token write paths use the
// service role from a server route), approvals, check-in, and post-event
// interest submission.

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { createActivityEvent } from '@/lib/activity';
import { enforceUsage, recordUsage } from '@/lib/usage';
import { hashToken, randomToken } from '@/lib/utils';
import { checkRateLimit } from '@/lib/rate-limit';

export const ApplicationSchema = z.object({
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  email: z.string().email().max(200),
  phone: z.string().min(5).max(40).optional().or(z.literal('')),
  age: z.coerce.number().int().min(18).max(120),
  gender: z.string().max(40).optional(),
  interested_in: z.string().max(40).optional(),
  relationship_goal: z.string().max(120).optional(),
  bio: z.string().max(1500).optional(),
  hobbies: z.string().max(500).optional(),
  conversation_topics: z.string().max(500).optional(),
  dealbreakers: z.string().max(500).optional(),
  preferred_age_min: z.coerce.number().int().min(18).max(120).optional(),
  preferred_age_max: z.coerce.number().int().min(18).max(120).optional(),
  consent_to_contact: z
    .union([z.literal('on'), z.literal('true'), z.boolean()])
    .optional()
    .transform((v) => v === 'on' || v === 'true' || v === true),
});

export type ApplicationInput = z.infer<typeof ApplicationSchema>;

export interface ApplyResult {
  ok: boolean;
  attendeeId?: string;
  privateToken?: string;
  error?: string;
}

export const applyToEvent = async (params: {
  eventSlug: string;
  input: ApplicationInput;
  answers?: Map<string, string>;
  clientIp?: string;
}): Promise<ApplyResult> => {
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id, organization_id, status, max_attendees, age_min, age_max, application_deadline')
    .eq('public_slug', params.eventSlug)
    .maybeSingle();
  if (!event) return { ok: false, error: 'Event not found' };

  // Per-event-per-IP: 10 applications / 10 minutes is generous for legit
  // traffic and blocks scripted abuse.
  const ipLimit = await checkRateLimit({
    action: 'apply',
    identifier: `${event.id}:${params.clientIp ?? 'anon'}`,
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!ipLimit.allowed) {
    return { ok: false, error: 'Too many applications from this device. Try again later.' };
  }
  // Per-event-per-email: 3 applications / 1 hour catches form-spammers
  // who rotate IPs but reuse an address.
  const emailLimit = await checkRateLimit({
    action: 'apply_email',
    identifier: `${event.id}:${params.input.email.toLowerCase()}`,
    limit: 3,
    windowMs: 60 * 60_000,
  });
  if (!emailLimit.allowed) {
    return { ok: false, error: 'This email has submitted too many applications. Try again later.' };
  }
  if (event.status !== 'published' && event.status !== 'live') {
    return { ok: false, error: 'Applications are not open for this event' };
  }
  if (event.application_deadline && new Date(event.application_deadline) < new Date()) {
    return { ok: false, error: 'Application deadline has passed' };
  }
  if (event.age_min && params.input.age < event.age_min) {
    return { ok: false, error: `You must be at least ${event.age_min} for this event` };
  }
  if (event.age_max && params.input.age > event.age_max) {
    return { ok: false, error: `Age limit for this event is ${event.age_max}` };
  }
  if (event.max_attendees) {
    const { count } = await svc
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .neq('status', 'declined');
    if ((count ?? 0) >= event.max_attendees) {
      return { ok: false, error: 'This event is full' };
    }
  }

  const usage = await enforceUsage(event.organization_id, 'attendees_registered', 1);
  if (!usage.allowed) return { ok: false, error: 'Host has reached their plan limit' };

  const token = randomToken();
  const tokenHash = await hashToken(token);

  const { data: existing } = await svc
    .from('attendees')
    .select('id')
    .eq('event_id', event.id)
    .ilike('email', params.input.email)
    .maybeSingle();
  if (existing) return { ok: false, error: 'You have already applied to this event' };

  const { data: created, error } = await svc
    .from('attendees')
    .insert({
      organization_id: event.organization_id,
      event_id: event.id,
      first_name: params.input.first_name,
      last_name: params.input.last_name,
      email: params.input.email,
      phone: params.input.phone || null,
      age: params.input.age,
      gender: params.input.gender ?? null,
      interested_in: params.input.interested_in ?? null,
      relationship_goal: params.input.relationship_goal ?? null,
      bio: params.input.bio ?? null,
      hobbies: params.input.hobbies ?? null,
      conversation_topics: params.input.conversation_topics ?? null,
      dealbreakers: params.input.dealbreakers ?? null,
      preferred_age_min: params.input.preferred_age_min ?? null,
      preferred_age_max: params.input.preferred_age_max ?? null,
      status: 'applied',
      consent_to_contact: params.input.consent_to_contact ?? false,
      private_token_hash: tokenHash,
    })
    .select('id')
    .single();
  if (error || !created) return { ok: false, error: error?.message ?? 'Could not save application' };

  await Promise.all([
    recordUsage(event.organization_id, 'attendees_registered'),
    createActivityEvent({
      organizationId: event.organization_id,
      eventId: event.id,
      actorType: 'attendee',
      actorId: created.id,
      eventType: 'ATTENDEE_APPLIED',
      entityType: 'attendee',
      entityId: created.id,
    }),
  ]);

  if (params.answers && params.answers.size > 0) {
    const rows = Array.from(params.answers.entries()).map(([questionId, answer]) => ({
      organization_id: event.organization_id,
      event_id: event.id,
      attendee_id: created.id,
      question_id: questionId,
      answer,
    }));
    await svc.from('attendee_answers').insert(rows);
  }

  return { ok: true, attendeeId: created.id, privateToken: token };
};

export const setAttendeeStatus = async (params: {
  organizationId: string;
  userId: string;
  attendeeId: string;
  status: 'approved' | 'declined' | 'waitlist';
}) => {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('attendees')
    .update({ status: params.status })
    .eq('id', params.attendeeId)
    .eq('organization_id', params.organizationId)
    .select('id, event_id')
    .single();
  if (error || !data) return { ok: false as const, error: error?.message };
  if (params.status === 'approved') {
    await createActivityEvent({
      organizationId: params.organizationId,
      eventId: data.event_id,
      actorType: 'host',
      actorId: params.userId,
      eventType: 'ATTENDEE_APPROVED',
      entityType: 'attendee',
      entityId: data.id,
    });
  }
  return { ok: true as const };
};

export const checkInAttendee = async (params: { token: string }) => {
  const svc = createServiceClient();
  const tokenHash = await hashToken(params.token);
  const { data: attendee, error } = await svc
    .from('attendees')
    .select('id, organization_id, event_id, first_name, checked_in')
    .eq('private_token_hash', tokenHash)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!attendee) return { ok: false as const, error: 'Invalid check-in link' };
  if (attendee.checked_in) {
    return {
      ok: true as const,
      alreadyCheckedIn: true,
      attendeeId: attendee.id,
      eventId: attendee.event_id,
      firstName: attendee.first_name,
    };
  }
  await svc
    .from('attendees')
    .update({ checked_in: true, checked_in_at: new Date().toISOString() })
    .eq('id', attendee.id);
  await createActivityEvent({
    organizationId: attendee.organization_id,
    eventId: attendee.event_id,
    actorType: 'attendee',
    actorId: attendee.id,
    eventType: 'ATTENDEE_CHECKED_IN',
    entityType: 'attendee',
    entityId: attendee.id,
  });
  return {
    ok: true as const,
    alreadyCheckedIn: false,
    attendeeId: attendee.id,
    eventId: attendee.event_id,
    firstName: attendee.first_name,
  };
};

export const findAttendeeByToken = async (token: string) => {
  const svc = createServiceClient();
  const tokenHash = await hashToken(token);
  const { data } = await svc
    .from('attendees')
    .select('id, organization_id, event_id, first_name, last_name, checked_in, status')
    .eq('private_token_hash', tokenHash)
    .maybeSingle();
  return data;
};
