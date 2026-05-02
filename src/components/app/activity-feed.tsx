'use client';
import * as React from 'react';
import { getBrowserClient } from '@/lib/supabase/browser';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface ActivityRow {
  id: string;
  event_type: string;
  entity_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const LABELS: Record<string, string> = {
  EVENT_CREATED: 'Event created',
  EVENT_PUBLISHED: 'Event published',
  ATTENDEE_APPLIED: 'New application',
  ATTENDEE_APPROVED: 'Attendee approved',
  ATTENDEE_CHECKED_IN: 'Attendee checked in',
  ROUND_SCHEDULE_GENERATED: 'Rotation generated',
  ROUND_STARTED: 'Round started',
  ROUND_ENDED: 'Round ended',
  EVENT_STARTED: 'Event started',
  EVENT_ENDED: 'Event ended',
  INTEREST_SUBMITTED: 'Interest submitted',
  MUTUAL_MATCH_CREATED: 'Mutual match',
  INTRO_EMAIL_SENT: 'Intro email sent',
  SUBSCRIPTION_CHANGED: 'Subscription updated',
  USAGE_LIMIT_REACHED: 'Usage limit reached',
  AI_MATCHING_RUN: 'AI matching run',
};

export function ActivityFeed({
  organizationId,
  eventId,
  initial,
}: {
  organizationId: string;
  eventId?: string;
  initial: ActivityRow[];
}) {
  const [rows, setRows] = React.useState<ActivityRow[]>(initial);

  React.useEffect(() => {
    const supabase = getBrowserClient();
    const filter = eventId
      ? `event_id=eq.${eventId}`
      : `organization_id=eq.${organizationId}`;
    const channel = supabase
      .channel(`activity:${eventId ?? organizationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_events', filter },
        (payload) => {
          const next = payload.new as ActivityRow;
          setRows((prev) => [next, ...prev].slice(0, 50));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, eventId]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet. Once your event goes live, action shows up here in real time.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start gap-3">
          <div className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
          <div className="flex-1 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{LABELS[row.event_type] ?? row.event_type}</span>
              <Badge variant="secondary">{formatDate(row.created_at)}</Badge>
            </div>
            {row.entity_type && (
              <div className="text-xs text-muted-foreground">{row.entity_type}</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
