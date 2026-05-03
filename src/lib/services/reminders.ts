// Idempotent reminder dispatch. Each event has three timestamps:
//   - reminder_24h_sent_at
//   - reminder_1h_sent_at
//   - post_event_links_sent_at
// We mark the timestamp BEFORE iterating attendees so a cron retry doesn't
// double-send. Per-attendee email_events still capture provider results.
//
// Each reminder reissues the attendee's private token (and updates the hash)
// so the link in the email is always functional. The previous token becomes
// inert as soon as we update the hash.

import { createServiceClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { sendEventReminder, sendPostEventLink } from '@/lib/email/send';
import { hashToken, randomToken } from '@/lib/utils';

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
    sent.reminders24h += await sendRemindersForEvent(ev.id, '24h');
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
    sent.reminders1h += await sendRemindersForEvent(ev.id, '1h');
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
    sent.postEvent += await sendPostEventLinksForEvent(ev.id);
  }

  return sent;
};

const sendRemindersForEvent = async (eventId: string, window: '24h' | '1h'): Promise<number> => {
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
    await sendEventReminder({
      organizationId: event.organization_id,
      eventId: event.id,
      eventTitle: event.title,
      startsAt: event.starts_at ? new Date(event.starts_at).toLocaleString() : '',
      venue: event.venue_name ?? '',
      recipientEmail: a.email,
      recipientFirstName: a.first_name ?? 'there',
      checkInUrl,
      window,
    });
    count += 1;
  }
  return count;
};

const sendPostEventLinksForEvent = async (eventId: string): Promise<number> => {
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
    await sendPostEventLink({
      organizationId: event.organization_id,
      eventId: event.id,
      eventTitle: event.title,
      recipientEmail: a.email,
      recipientFirstName: a.first_name ?? 'there',
      postEventUrl,
    });
    count += 1;
  }
  return count;
};
