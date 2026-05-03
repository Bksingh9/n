// One-click demo: seeds a published event with sample attendees, runs
// deterministic compatibility scoring, and generates a rotation. Lets a
// fresh host see the whole product working in 30 seconds without manual
// data entry.
//
// Demo data does NOT bypass usage tracking on purpose — limits should still
// apply so the host sees real-world behavior.

import { createServiceClient } from '@/lib/supabase/server';
import { createActivityEvent } from '@/lib/activity';
import { createEvent } from '@/lib/services/events';
import { runMatching, generateAndSaveRotations } from '@/lib/services/matching';
import { hashToken, randomToken, slugify } from '@/lib/utils';

interface SeedAttendee {
  first_name: string;
  last_name: string;
  email_local: string;
  age: number;
  gender: string;
  interested_in: string;
  hobbies: string;
  conversation_topics: string;
  bio: string;
  preferred_age_min: number;
  preferred_age_max: number;
}

const DEMO_ATTENDEES: SeedAttendee[] = [
  { first_name: 'Ari', last_name: 'C', email_local: 'ari', age: 31, gender: 'woman', interested_in: 'men', hobbies: 'climbing, jazz, baking', conversation_topics: 'philosophy, travel, food', bio: 'Mid-rise climber and amateur baker.', preferred_age_min: 28, preferred_age_max: 38 },
  { first_name: 'Ben', last_name: 'L', email_local: 'ben', age: 33, gender: 'man', interested_in: 'women', hobbies: 'climbing, films, jazz', conversation_topics: 'film, travel, food', bio: 'Reads too much. Likes long walks to coffee.', preferred_age_min: 27, preferred_age_max: 36 },
  { first_name: 'Cami', last_name: 'P', email_local: 'cami', age: 29, gender: 'woman', interested_in: 'men', hobbies: 'travel, food, dance', conversation_topics: 'travel, food, music', bio: 'Splits time between Lisbon and Brooklyn.', preferred_age_min: 27, preferred_age_max: 38 },
  { first_name: 'Dev', last_name: 'M', email_local: 'dev', age: 34, gender: 'man', interested_in: 'women', hobbies: 'travel, food, basketball', conversation_topics: 'travel, sports, food', bio: 'Pickup basketball and slow Sundays.', preferred_age_min: 27, preferred_age_max: 36 },
  { first_name: 'Eli', last_name: 'R', email_local: 'eli', age: 30, gender: 'woman', interested_in: 'men', hobbies: 'yoga, books, jazz', conversation_topics: 'books, music, philosophy', bio: 'Bookstore loiterer and yoga regular.', preferred_age_min: 28, preferred_age_max: 38 },
  { first_name: 'Finn', last_name: 'O', email_local: 'finn', age: 32, gender: 'man', interested_in: 'women', hobbies: 'cycling, food, films', conversation_topics: 'film, food, travel', bio: 'Always planning the next trip.', preferred_age_min: 27, preferred_age_max: 35 },
];

export const createDemoEvent = async (params: {
  organizationId: string;
  userId: string;
}): Promise<{ ok: true; eventId: string; slug: string } | { ok: false; error: string }> => {
  const startsAt = new Date(Date.now() + 7 * 24 * 3600_000);
  const endsAt = new Date(startsAt.getTime() + 2 * 3600_000);

  const created = await createEvent({
    organizationId: params.organizationId,
    userId: params.userId,
    input: {
      title: `Demo Mixer · ${startsAt.toLocaleDateString()}`,
      description:
        'Auto-generated demo event for exploring DateOps Live. Attendees, scoring, and a rotation are pre-populated. Delete it whenever you like.',
      event_type: 'speed dating',
      venue_name: 'Demo Lounge',
      city: 'San Francisco',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      age_min: 25,
      age_max: 40,
      max_attendees: 24,
      relationship_goal: 'serious dating',
    },
  });
  if (!created.ok) return { ok: false, error: created.error === 'PLAN_LIMIT' ? 'Plan event limit reached' : (created.error ?? 'Could not create demo event') };

  const eventId = created.eventId;
  const svc = createServiceClient();

  await svc.from('events').update({ status: 'published' }).eq('id', eventId);

  const emailDomain = `demo-${slugify(eventId.slice(0, 8))}.example`;
  for (const a of DEMO_ATTENDEES) {
    const token = randomToken();
    await svc.from('attendees').insert({
      organization_id: params.organizationId,
      event_id: eventId,
      first_name: a.first_name,
      last_name: a.last_name,
      email: `${a.email_local}@${emailDomain}`,
      age: a.age,
      gender: a.gender,
      interested_in: a.interested_in,
      relationship_goal: 'serious dating',
      bio: a.bio,
      hobbies: a.hobbies,
      conversation_topics: a.conversation_topics,
      preferred_age_min: a.preferred_age_min,
      preferred_age_max: a.preferred_age_max,
      status: 'approved',
      checked_in: true,
      consent_to_contact: true,
      private_token_hash: await hashToken(token),
    });
  }

  // Sample custom question.
  await svc.from('event_questions').insert({
    organization_id: params.organizationId,
    event_id: eventId,
    question: 'What kind of conversation makes you light up?',
    type: 'textarea',
    required: false,
    sort_order: 0,
  });

  // Run deterministic matching (no AI cost) + rotation.
  await runMatching({
    organizationId: params.organizationId,
    userId: params.userId,
    eventId,
    useAi: false,
  });
  await generateAndSaveRotations({
    organizationId: params.organizationId,
    userId: params.userId,
    eventId,
    options: {
      table_count: 3,
      round_count: 4,
      round_duration_minutes: 6,
      break_duration_minutes: 2,
      start_time: startsAt.toISOString(),
    },
  });

  await createActivityEvent({
    organizationId: params.organizationId,
    eventId,
    actorType: 'system',
    actorId: params.userId,
    eventType: 'EVENT_PUBLISHED',
    metadata: { kind: 'demo_seeded' },
  });

  return { ok: true, eventId, slug: created.slug! };
};
