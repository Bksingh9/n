import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrg } from '@/lib/auth';
import { planFeatures } from '@/lib/roles';
import { createServiceClient } from '@/lib/supabase/server';
import { toCsv } from '@/lib/csv';
import type { PlanId } from '@/lib/plans';

const Kind = z.enum(['attendees', 'matches', 'emails']);

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await requireOrg();
  const features = planFeatures(ctx.plan as PlanId);
  if (!features.csvExport) {
    return NextResponse.json({ error: 'CSV export is on the Pro and Agency plans' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const kindResult = Kind.safeParse(searchParams.get('kind') ?? 'attendees');
  if (!kindResult.success) {
    return NextResponse.json({ error: 'Invalid export kind' }, { status: 400 });
  }
  const kind = kindResult.data;
  const { eventId } = await params;

  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id, title')
    .eq('id', eventId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  let body = '';
  let filename = '';

  if (kind === 'attendees') {
    const { data } = await svc
      .from('attendees')
      .select('first_name, last_name, email, phone, age, gender, interested_in, relationship_goal, status, checked_in, consent_to_contact, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    body = toCsv((data ?? []) as Array<Record<string, unknown>>, [
      'first_name', 'last_name', 'email', 'phone', 'age', 'gender', 'interested_in', 'relationship_goal', 'status', 'checked_in', 'consent_to_contact', 'created_at',
    ]);
    filename = `attendees-${eventId}.csv`;
  } else if (kind === 'matches') {
    const { data: matches } = await svc
      .from('mutual_matches')
      .select('attendee_a_id, attendee_b_id, match_type, intro_email_sent, intro_email_sent_at, created_at')
      .eq('event_id', eventId);
    const ids = new Set<string>();
    (matches ?? []).forEach((m) => { ids.add(m.attendee_a_id); ids.add(m.attendee_b_id); });
    const names = new Map<string, { first_name: string | null; last_name: string | null; email: string | null }>();
    if (ids.size > 0) {
      const { data: at } = await svc.from('attendees').select('id, first_name, last_name, email').in('id', Array.from(ids));
      (at ?? []).forEach((a) => names.set(a.id, { first_name: a.first_name, last_name: a.last_name, email: a.email }));
    }
    const rows = (matches ?? []).map((m) => {
      const a = names.get(m.attendee_a_id);
      const b = names.get(m.attendee_b_id);
      return {
        a_first_name: a?.first_name, a_last_name: a?.last_name, a_email: a?.email,
        b_first_name: b?.first_name, b_last_name: b?.last_name, b_email: b?.email,
        match_type: m.match_type, intro_email_sent: m.intro_email_sent, intro_email_sent_at: m.intro_email_sent_at, created_at: m.created_at,
      };
    });
    body = toCsv(rows, [
      'a_first_name', 'a_last_name', 'a_email', 'b_first_name', 'b_last_name', 'b_email',
      'match_type', 'intro_email_sent', 'intro_email_sent_at', 'created_at',
    ]);
    filename = `matches-${eventId}.csv`;
  } else {
    const { data } = await svc
      .from('email_events')
      .select('email_type, status, recipient_email, provider_message_id, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    body = toCsv((data ?? []) as Array<Record<string, unknown>>, [
      'created_at', 'email_type', 'status', 'recipient_email', 'provider_message_id',
    ]);
    filename = `emails-${eventId}.csv`;
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
