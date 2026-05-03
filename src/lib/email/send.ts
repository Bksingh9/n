// Resend wrappers. Each send checks usage limits and logs an email_event.
// Templates live in /src/emails.

import { Resend } from 'resend';
import { render } from '@react-email/components';
import { serverEnv, publicEnv } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase/server';
import { enforceUsage, recordUsage } from '@/lib/usage';
import ApplicationReceivedEmail from '@/emails/application-received';
import IntroEmail from '@/emails/intro-email';
import TeamInviteEmail from '@/emails/team-invite';
import EventReminderEmail from '@/emails/event-reminder';
import PostEventLinkEmail from '@/emails/post-event-link';

const getResend = () => {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
};

const logEmail = async (params: {
  organizationId: string;
  eventId: string | null;
  recipient: string;
  type: string;
  status: string;
  providerId?: string | null;
}) => {
  const svc = createServiceClient();
  await svc.from('email_events').insert({
    organization_id: params.organizationId,
    event_id: params.eventId,
    recipient_email: params.recipient,
    email_type: params.type,
    status: params.status,
    provider_message_id: params.providerId ?? null,
  });
};

export const sendApplicationReceived = async (params: {
  attendeeEmail: string;
  attendeeFirstName: string;
  eventTitle: string;
  checkInToken: string;
  eventId: string;
}) => {
  const svc = createServiceClient();
  const { data: event } = await svc.from('events').select('organization_id').eq('id', params.eventId).single();
  const orgId = event?.organization_id;
  if (!orgId) return;
  const usage = await enforceUsage(orgId, 'emails_sent', 1);
  if (!usage.allowed) {
    await logEmail({ organizationId: orgId, eventId: params.eventId, recipient: params.attendeeEmail, type: 'application_received', status: 'skipped_limit' });
    return;
  }
  const resend = getResend();
  const env = serverEnv();
  const checkInUrl = `${publicEnv.APP_URL}/check-in/${params.checkInToken}`;
  const html = await render(
    ApplicationReceivedEmail({
      firstName: params.attendeeFirstName,
      eventTitle: params.eventTitle,
      checkInUrl,
    }),
  );
  if (!resend) {
    await logEmail({ organizationId: orgId, eventId: params.eventId, recipient: params.attendeeEmail, type: 'application_received', status: 'logged_no_provider' });
    await recordUsage(orgId, 'emails_sent');
    return;
  }
  try {
    const res = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: params.attendeeEmail,
      subject: `You're on the list for ${params.eventTitle}`,
      html,
    });
    await logEmail({ organizationId: orgId, eventId: params.eventId, recipient: params.attendeeEmail, type: 'application_received', status: 'sent', providerId: res.data?.id });
    await recordUsage(orgId, 'emails_sent');
  } catch (err) {
    console.error('[email] application_received failed', err);
    await logEmail({ organizationId: orgId, eventId: params.eventId, recipient: params.attendeeEmail, type: 'application_received', status: 'failed' });
  }
};

export const sendIntroEmail = async (params: {
  organizationId: string;
  eventId: string;
  eventTitle: string;
  a: { firstName: string; lastName: string; email: string };
  b: { firstName: string; lastName: string; email: string };
}) => {
  const usage = await enforceUsage(params.organizationId, 'emails_sent', 2);
  if (!usage.allowed) {
    await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: params.a.email, type: 'intro', status: 'skipped_limit' });
    await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: params.b.email, type: 'intro', status: 'skipped_limit' });
    return;
  }
  const resend = getResend();
  const env = serverEnv();

  const sendOne = async (to: { firstName: string; email: string }, other: { firstName: string; lastName: string; email: string }) => {
    const html = await render(
      IntroEmail({
        toFirstName: to.firstName,
        otherFirstName: other.firstName,
        otherLastName: other.lastName,
        otherEmail: other.email,
        eventTitle: params.eventTitle,
      }),
    );
    if (!resend) {
      await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: to.email, type: 'intro', status: 'logged_no_provider' });
      return;
    }
    try {
      const res = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: to.email,
        subject: `Mutual match from ${params.eventTitle}`,
        html,
      });
      await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: to.email, type: 'intro', status: 'sent', providerId: res.data?.id });
    } catch (err) {
      console.error('[email] intro failed', err);
      await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: to.email, type: 'intro', status: 'failed' });
    }
  };

  await Promise.all([
    sendOne({ firstName: params.a.firstName, email: params.a.email }, params.b),
    sendOne({ firstName: params.b.firstName, email: params.b.email }, params.a),
  ]);
  await recordUsage(params.organizationId, 'emails_sent', { amount: 2 });
};

export const sendTeamInvite = async (params: {
  organizationId: string;
  organizationName: string;
  inviterName: string;
  recipientEmail: string;
  role: string;
  acceptUrl: string;
}) => {
  const usage = await enforceUsage(params.organizationId, 'emails_sent', 1);
  if (!usage.allowed) {
    await logEmail({ organizationId: params.organizationId, eventId: null, recipient: params.recipientEmail, type: 'team_invite', status: 'skipped_limit' });
    return;
  }
  const resend = getResend();
  const env = serverEnv();
  const html = await render(
    TeamInviteEmail({
      inviterName: params.inviterName,
      organizationName: params.organizationName,
      acceptUrl: params.acceptUrl,
      role: params.role,
    }),
  );
  if (!resend) {
    await logEmail({ organizationId: params.organizationId, eventId: null, recipient: params.recipientEmail, type: 'team_invite', status: 'logged_no_provider' });
    await recordUsage(params.organizationId, 'emails_sent');
    return;
  }
  try {
    const res = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: params.recipientEmail,
      subject: `You've been invited to ${params.organizationName} on DateOps Live`,
      html,
    });
    await logEmail({ organizationId: params.organizationId, eventId: null, recipient: params.recipientEmail, type: 'team_invite', status: 'sent', providerId: res.data?.id });
    await recordUsage(params.organizationId, 'emails_sent');
  } catch (err) {
    console.error('[email] team_invite failed', err);
    await logEmail({ organizationId: params.organizationId, eventId: null, recipient: params.recipientEmail, type: 'team_invite', status: 'failed' });
  }
};

export const sendEventReminder = async (params: {
  organizationId: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  venue: string;
  recipientEmail: string;
  recipientFirstName: string;
  checkInUrl: string;
  window: '24h' | '1h';
}) => {
  const usage = await enforceUsage(params.organizationId, 'emails_sent', 1);
  if (!usage.allowed) {
    await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: params.recipientEmail, type: `reminder_${params.window}`, status: 'skipped_limit' });
    return;
  }
  const resend = getResend();
  const env = serverEnv();
  const html = await render(
    EventReminderEmail({
      firstName: params.recipientFirstName,
      eventTitle: params.eventTitle,
      startsAt: params.startsAt,
      venue: params.venue,
      checkInUrl: params.checkInUrl,
      window: params.window,
    }),
  );
  if (!resend) {
    await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: params.recipientEmail, type: `reminder_${params.window}`, status: 'logged_no_provider' });
    await recordUsage(params.organizationId, 'emails_sent');
    return;
  }
  try {
    const res = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: params.recipientEmail,
      subject: params.window === '24h' ? `Tomorrow: ${params.eventTitle}` : `Starting soon: ${params.eventTitle}`,
      html,
    });
    await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: params.recipientEmail, type: `reminder_${params.window}`, status: 'sent', providerId: res.data?.id });
    await recordUsage(params.organizationId, 'emails_sent');
  } catch (err) {
    console.error('[email] reminder failed', err);
    await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: params.recipientEmail, type: `reminder_${params.window}`, status: 'failed' });
  }
};

export const sendPostEventLink = async (params: {
  organizationId: string;
  eventId: string;
  eventTitle: string;
  recipientEmail: string;
  recipientFirstName: string;
  postEventUrl: string;
}) => {
  const usage = await enforceUsage(params.organizationId, 'emails_sent', 1);
  if (!usage.allowed) {
    await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: params.recipientEmail, type: 'post_event_link', status: 'skipped_limit' });
    return;
  }
  const resend = getResend();
  const env = serverEnv();
  const html = await render(
    PostEventLinkEmail({
      firstName: params.recipientFirstName,
      eventTitle: params.eventTitle,
      postEventUrl: params.postEventUrl,
    }),
  );
  if (!resend) {
    await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: params.recipientEmail, type: 'post_event_link', status: 'logged_no_provider' });
    await recordUsage(params.organizationId, 'emails_sent');
    return;
  }
  try {
    const res = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: params.recipientEmail,
      subject: `Pick people you'd like to meet again — ${params.eventTitle}`,
      html,
    });
    await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: params.recipientEmail, type: 'post_event_link', status: 'sent', providerId: res.data?.id });
    await recordUsage(params.organizationId, 'emails_sent');
  } catch (err) {
    console.error('[email] post_event_link failed', err);
    await logEmail({ organizationId: params.organizationId, eventId: params.eventId, recipient: params.recipientEmail, type: 'post_event_link', status: 'failed' });
  }
};
