// Demo seed. Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env.
// Creates one demo organization, one event, and a handful of attendees.
// Idempotent on org slug "dateops-demo".
//
// Run with: npx tsx scripts/seed.ts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.');
  process.exit(1);
}

const svc = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const main = async () => {
  let { data: org } = await svc.from('organizations').select('id').eq('slug', 'dateops-demo').maybeSingle();
  if (!org) {
    const { data, error } = await svc
      .from('organizations')
      .insert({ name: 'DateOps Demo', slug: 'dateops-demo', plan: 'pro', city: 'Brooklyn', event_type: 'speed dating' })
      .select('id')
      .single();
    if (error) throw error;
    org = data;
    console.log('Created org', org!.id);
  }

  const { data: event } = await svc
    .from('events')
    .insert({
      organization_id: org!.id,
      title: 'Brooklyn Speed Dating · 28-38',
      description: 'A friendly speed-dating night in Williamsburg. Six rounds, six minutes each.',
      event_type: 'speed dating',
      venue_name: 'The Living Room',
      city: 'Brooklyn, NY',
      starts_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
      ends_at: new Date(Date.now() + 7 * 24 * 3600_000 + 2 * 3600_000).toISOString(),
      status: 'published',
      public_slug: `brooklyn-speed-${Math.random().toString(36).slice(2, 6)}`,
      age_min: 28,
      age_max: 38,
      max_attendees: 24,
      relationship_goal: 'serious dating',
    })
    .select('id, public_slug')
    .single();

  console.log('Created event', event?.id, event?.public_slug);

  const sample = [
    { first_name: 'Ari', last_name: 'C', email: 'ari@example.com', age: 31, gender: 'woman', interested_in: 'men', hobbies: 'climbing, jazz, baking' },
    { first_name: 'Ben', last_name: 'L', email: 'ben@example.com', age: 33, gender: 'man', interested_in: 'women', hobbies: 'climbing, films, jazz' },
    { first_name: 'Cami', last_name: 'P', email: 'cami@example.com', age: 29, gender: 'woman', interested_in: 'men', hobbies: 'travel, food, dance' },
    { first_name: 'Dev', last_name: 'M', email: 'dev@example.com', age: 34, gender: 'man', interested_in: 'women', hobbies: 'travel, food, basketball' },
  ];

  for (const a of sample) {
    await svc.from('attendees').insert({
      organization_id: org!.id,
      event_id: event!.id,
      ...a,
      relationship_goal: 'serious dating',
      status: 'approved',
      checked_in: true,
      consent_to_contact: true,
      preferred_age_min: 27,
      preferred_age_max: 40,
    });
  }
  console.log('Seeded attendees');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
