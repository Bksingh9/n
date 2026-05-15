// Job handler dispatch. Imported only by the cron worker route; never
// by code paths that enqueue jobs.

import type { JobRow } from '@/lib/supabase/types';
import {
  claimReadyJobs,
  markJobDone,
  markJobFailed,
  type JobKind,
  type SendIntroPayload,
  type SendPostEventPayload,
  type SendReminderPayload,
} from '@/lib/services/jobs';
import { sendIntroEmailForMatch } from '@/lib/services/postevent';
import { sendEventReminder, sendPostEventLink } from '@/lib/email/send';

export const runJob = async (job: JobRow): Promise<void> => {
  switch (job.kind as JobKind) {
    case 'send_intro_for_match': {
      const p = job.payload as unknown as SendIntroPayload;
      await sendIntroEmailForMatch(p.match_id);
      return;
    }
    case 'send_event_reminder': {
      const p = job.payload as unknown as SendReminderPayload;
      await sendEventReminder({
        organizationId: p.organization_id,
        eventId: p.event_id,
        eventTitle: p.event_title,
        startsAt: p.starts_at,
        venue: p.venue,
        recipientEmail: p.recipient_email,
        recipientFirstName: p.recipient_first_name,
        checkInUrl: p.check_in_url,
        window: p.window,
      });
      return;
    }
    case 'send_post_event_link': {
      const p = job.payload as unknown as SendPostEventPayload;
      await sendPostEventLink({
        organizationId: p.organization_id,
        eventId: p.event_id,
        eventTitle: p.event_title,
        recipientEmail: p.recipient_email,
        recipientFirstName: p.recipient_first_name,
        postEventUrl: p.post_event_url,
      });
      return;
    }
    default:
      throw new Error(`Unknown job kind: ${job.kind}`);
  }
};

export const processBatch = async (limit = 20): Promise<{ processed: number; failed: number; dead: number }> => {
  const jobs = await claimReadyJobs(limit);
  let processed = 0;
  let failed = 0;
  let dead = 0;
  for (const job of jobs) {
    try {
      await runJob(job);
      await markJobDone(job.id);
      processed += 1;
    } catch (err) {
      const reachedMax = job.attempts >= job.max_attempts;
      await markJobFailed(job.id, job.attempts, job.max_attempts, err);
      if (reachedMax) dead += 1;
      else failed += 1;
    }
  }
  return { processed, failed, dead };
};
