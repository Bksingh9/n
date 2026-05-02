// Server-side usage tracking and plan limit enforcement.
// All limit checks must be enforced here, not in the client.

import { createServiceClient } from '@/lib/supabase/server';
import { PLANS, type PlanId, type UsageMetric } from '@/lib/plans';
import { createActivityEvent } from '@/lib/activity';

export interface UsageCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  plan: PlanId;
  metric: UsageMetric;
}

const startOfMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

export const getMonthlyUsage = async (
  organizationId: string,
  metric: UsageMetric,
): Promise<number> => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('usage_events')
    .select('quantity')
    .eq('organization_id', organizationId)
    .eq('event_type', metric)
    .gte('created_at', startOfMonth());
  if (error) {
    console.error('[usage] read failed', error.message);
    return 0;
  }
  return (data ?? []).reduce((sum, row) => sum + (row.quantity ?? 0), 0);
};

export const getOrgPlan = async (organizationId: string): Promise<PlanId> => {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', organizationId)
    .single();
  const plan = (data?.plan ?? 'free') as PlanId;
  return PLANS[plan] ? plan : 'free';
};

export const checkUsage = async (
  organizationId: string,
  metric: UsageMetric,
  amount = 1,
): Promise<UsageCheckResult> => {
  const plan = await getOrgPlan(organizationId);
  const limit = PLANS[plan].limits[metric];
  const used = await getMonthlyUsage(organizationId, metric);
  const remaining = Math.max(0, limit - used);
  return {
    allowed: used + amount <= limit,
    used,
    limit,
    remaining,
    plan,
    metric,
  };
};

export const recordUsage = async (
  organizationId: string,
  metric: UsageMetric,
  opts: { userId?: string | null; amount?: number; metadata?: Record<string, unknown> } = {},
) => {
  const supabase = createServiceClient();
  const { error } = await supabase.from('usage_events').insert({
    organization_id: organizationId,
    user_id: opts.userId ?? null,
    event_type: metric,
    quantity: opts.amount ?? 1,
    metadata: (opts.metadata as never) ?? null,
  });
  if (error) console.error('[usage] insert failed', error.message);
};

export const enforceUsage = async (
  organizationId: string,
  metric: UsageMetric,
  amount = 1,
): Promise<UsageCheckResult> => {
  const result = await checkUsage(organizationId, metric, amount);
  if (!result.allowed) {
    await createActivityEvent({
      organizationId,
      eventType: 'USAGE_LIMIT_REACHED',
      metadata: { metric, used: result.used, limit: result.limit, plan: result.plan },
    });
  }
  return result;
};

export const getAllUsage = async (organizationId: string) => {
  const metrics: UsageMetric[] = [
    'events_created',
    'attendees_registered',
    'ai_matching_runs',
    'emails_sent',
    'team_members_added',
  ];
  const plan = await getOrgPlan(organizationId);
  const rows = await Promise.all(
    metrics.map(async (m) => {
      const used = await getMonthlyUsage(organizationId, m);
      return { metric: m, used, limit: PLANS[plan].limits[m] };
    }),
  );
  return { plan, items: rows };
};
