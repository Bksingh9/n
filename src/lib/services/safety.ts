// Safety reporting + per-attendee safety flag management.
// Public submissions are authenticated via the reporter's hashed private
// token. Hosts review and resolve from /app/events/<id>/safety.

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { createActivityEvent } from '@/lib/activity';
import { findAttendeeByToken } from '@/lib/services/attendees';
import { checkRateLimit } from '@/lib/rate-limit';
import type { SafetyReportRow } from '@/lib/supabase/types';

export const SafetyCategories = [
  'harassment',
  'misrepresentation',
  'unsafe_behavior',
  'venue_concern',
  'other',
] as const;
export type SafetyCategory = (typeof SafetyCategories)[number];

export const SafetyReportSchema = z.object({
  category: z.enum(SafetyCategories),
  details: z.string().min(1, 'Add a short description').max(2000),
  reported_attendee_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('')),
});

export type SafetyReportInput = z.infer<typeof SafetyReportSchema>;

export const reportSafetyConcern = async (params: {
  reporterToken: string;
  input: SafetyReportInput;
}) => {
  const reporter = await findAttendeeByToken(params.reporterToken);
  if (!reporter) return { ok: false as const, error: 'Invalid link' };

  // Coarse rate limit in addition to the 5-per-24h business rule below:
  // hold script-driven abuse to 1 submission/minute per reporter.
  const burst = await checkRateLimit({
    action: 'safety_report_burst',
    identifier: reporter.id,
    limit: 1,
    windowMs: 60_000,
  });
  if (!burst.allowed) {
    return { ok: false as const, error: 'Please wait a moment before submitting another report.' };
  }

  const svc = createServiceClient();
  const reportedId =
    params.input.reported_attendee_id && params.input.reported_attendee_id !== reporter.id
      ? params.input.reported_attendee_id
      : null;

  // Anti-abuse: cap at 5 open reports per reporter per event in 24h.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await svc
    .from('safety_reports')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', reporter.event_id)
    .eq('reporter_attendee_id', reporter.id)
    .gte('created_at', since);
  if ((count ?? 0) >= 5) {
    return { ok: false as const, error: 'You have submitted too many reports recently. Please contact the host directly.' };
  }

  const { data, error } = await svc
    .from('safety_reports')
    .insert({
      organization_id: reporter.organization_id,
      event_id: reporter.event_id,
      reporter_attendee_id: reporter.id,
      reported_attendee_id: reportedId,
      category: params.input.category,
      details: params.input.details,
      status: 'open',
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? 'Could not submit report' };

  await createActivityEvent({
    organizationId: reporter.organization_id,
    eventId: reporter.event_id,
    actorType: 'attendee',
    actorId: reporter.id,
    eventType: 'USAGE_LIMIT_REACHED', // reused channel; see metadata.kind
    entityType: 'safety_report',
    entityId: data.id,
    metadata: { kind: 'safety_report_submitted', category: params.input.category },
  });

  return { ok: true as const, reportId: data.id };
};

export const listSafetyReports = async (params: {
  organizationId: string;
  eventId?: string;
  status?: string;
}): Promise<SafetyReportRow[]> => {
  const svc = createServiceClient();
  let query = svc
    .from('safety_reports')
    .select('*')
    .eq('organization_id', params.organizationId)
    .order('created_at', { ascending: false });
  if (params.eventId) query = query.eq('event_id', params.eventId);
  if (params.status) query = query.eq('status', params.status);
  const { data } = await query;
  return (data ?? []) as SafetyReportRow[];
};

export const resolveSafetyReport = async (params: {
  organizationId: string;
  userId: string;
  reportId: string;
  status: 'resolved' | 'dismissed';
  note?: string;
}) => {
  const svc = createServiceClient();
  const { error } = await svc
    .from('safety_reports')
    .update({
      status: params.status,
      resolved_by: params.userId,
      resolved_at: new Date().toISOString(),
      resolution_note: params.note ?? null,
    })
    .eq('id', params.reportId)
    .eq('organization_id', params.organizationId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
};

export const setSafetyFlag = async (params: {
  organizationId: string;
  attendeeId: string;
  value: boolean;
}) => {
  const svc = createServiceClient();
  const { error } = await svc
    .from('attendees')
    .update({ safety_flag: params.value })
    .eq('id', params.attendeeId)
    .eq('organization_id', params.organizationId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
};
