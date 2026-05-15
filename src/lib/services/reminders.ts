// Idempotent reminder dispatch. Each event has three timestamps:
//   - reminder_24h_sent_at
//   - reminder_1h_sent_at
//   - post_event_links_sent_at
// We mark the timestamp BEFORE enqueuing per-attendee jobs so a cron retry
// doesn't double-enqueue. Each per-attendee send is its own job so a
// Resend hiccup on one recipient doesn't block the rest of the batch and
// the job queue handles retries.
//
// Each reminder reissues the attendee's private token (and updates the
// hash) so the link in the email is always functional. The previous
// token becomes inert as soon as we update the hash.

import { createServiceClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { hashToken, randomToken } from '@/lib/utils';
import { enqueueJob } from '@/lib/services/jobs';

const ONE_HOUR_MS = 3600_000;

export const dispatchReminders = async (now = new Date()) => {
  const svc = createServiceClient();
  const sent = { reminders24h: 0, reminders1h: 0, postEvent: 0, eventsTouched: 0 };

  // 24h reminders.
  const lower24 = new Date(now.getTime() + 23 * ONE_HOUR_MS).toISOString();
  const upper24 = new Date(now.getTime() + 25 * ONE_HOUR_MS).toISOString();
  const { data: events24 } = await svc
    .from('events')
    .select('id')
    .gte('starts_at', lower24)
    .lte('starts_at', upper24)
    .is('reminder_24h_sent_at', null)
    .in('status', ['published', 'live']);
  for (const ev of events24 ?? []) {
    sent.eventsTouched += 1;
    await svc.from('events').update({ reminder_24h_sent_at: now.toISOString() }).eq('id', ev.id);
    sent.reminders24h += await enqueueRemindersForEvent(ev.id, '24h');
  }

  // 1h reminders.
  const lower1 = new Date(now.getTime() + 30 * 60_000).toISOString();
  const upper1 = new Date(now.getTime() + 90 * 60_000).toISOString();
  const { data: events1 } = await svc
    .from('events')
    .select('id')
    .gte('starts_at', lower1)
    .lte('starts_at', upper1)
    .is('reminder_1h_sent_at', null)
    .in('status', ['published', 'live']);
  for (const ev of events1 ?? []) {
    sent.eventsTouched += 1;
    await svc.from('events').update({ reminder_1h_sent_at: now.toISOString() }).eq('id', ev.id);
    sent.reminders1h += await enqueueRemindersForEvent(ev.id, '1h');
  }

  // Post-event links: events that ended in the last 6 hours.
  const sixAgo = new Date(now.getTime() - 6 * ONE_HOUR_MS).toISOString();
  const { data: postEvents } = await svc
    .from('events')
    .select('id')
    .lte('ends_at', now.toISOString())
    .gte('ends_at', sixAgo)
    .is('post_event_links_sent_at', null)
    .in('status', ['live', 'completed', 'published']);
  for (const ev of postEvents ?? []) {
    sent.eventsTouched += 1;
    await svc.from('events').update({ post_event_links_sent_at: now.toISOString() }).eq('id', ev.id);
    sent.postEvent += await enqueuePostEventLinksForEvent(ev.id);
  }

  return sent;
};

const enqueueRemindersForEvent = async (eventId: string, window: '24h' | '1h'): Promise<number> => {
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id, organization_id, title, starts_at, venue_name')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return 0;

  const { data: attendees } = await svc
    .from('attendees')
    .select('id, first_name, email, consent_to_contact, status')
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .eq('consent_to_contact', true);

  let count = 0;
  for (const a of attendees ?? []) {
    if (!a.email) continue;
    const token = randomToken();
    await svc.from('attendees').update({ private_token_hash: await hashToken(token) }).eq('id', a.id);
    const checkInUrl = `${publicEnv.APP_URL}/check-in/${token}`;
    await enqueueJob({
      kind: 'send_event_reminder',
      organizationId: event.organization_id,
      payload: {
        organization_id: event.organization_id,
        event_id: event.id,
        event_title: event.title,
        starts_at: event.starts_at ? new Date(event.starts_at).toLocaleString() : '',
        venue: event.venue_name ?? '',
        recipient_email: a.email,
        recipient_first_name: a.first_name ?? 'there',
        check_in_url: checkInUrl,
        window,
      },
    });
    count += 1;
  }
  return count;
};

const enqueuePostEventLinksForEvent = async (eventId: string): Promise<number> => {
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id, organization_id, title')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return 0;

  const { data: attendees } = await svc
    .from('attendees')
    .select('id, first_name, email, consent_to_contact, checked_in')
    .eq('event_id', eventId)
    .eq('checked_in', true)
    .eq('consent_to_contact', true);

  let count = 0;
  for (const a of attendees ?? []) {
    if (!a.email) continue;
    const token = randomToken();
    await svc.from('attendees').update({ private_token_hash: await hashToken(token) }).eq('id', a.id);
    const postEventUrl = `${publicEnv.APP_URL}/post-event/${token}`;
    await enqueueJob({
      kind: 'send_post_event_link',
      organizationId: event.organization_id,
      payload: {
        organization_id: event.organization_id,
        event_id: event.id,
        event_title: event.title,
        recipient_email: a.email,
        recipient_first_name: a.first_name ?? 'there',
        post_event_url: postEventUrl,
      },
    });
    count += 1;
  }
  return count;
};
