// Plan definitions. Limits are enforced server-side in lib/usage.ts.

export type PlanId = 'free' | 'starter' | 'pro' | 'agency';

export type UsageMetric =
  | 'events_created'
  | 'attendees_registered'
  | 'ai_matching_runs'
  | 'emails_sent'
  | 'team_members_added';

export interface PlanLimits {
  events_created: number;
  attendees_registered: number;
  ai_matching_runs: number;
  emails_sent: number;
  team_members_added: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  envPriceKey?: 'STRIPE_PRICE_STARTER' | 'STRIPE_PRICE_PRO' | 'STRIPE_PRICE_AGENCY';
  features: string[];
  limits: PlanLimits;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    features: ['1 event/month', '25 attendees/month', 'Basic check-in', 'Basic post-event matches'],
    limits: {
      events_created: 1,
      attendees_registered: 25,
      ai_matching_runs: 0,
      emails_sent: 50,
      team_members_added: 1,
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 49,
    envPriceKey: 'STRIPE_PRICE_STARTER',
    features: [
      '3 events/month',
      '150 attendees/month',
      'Compatibility scoring',
      'Post-event mutual matches',
      'Email reminders',
    ],
    limits: {
      events_created: 3,
      attendees_registered: 150,
      ai_matching_runs: 25,
      emails_sent: 500,
      team_members_added: 2,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 149,
    envPriceKey: 'STRIPE_PRICE_PRO',
    features: [
      '15 events/month',
      '1,000 attendees/month',
      'Live command center',
      'Rotation generator',
      'Email automation',
      'Analytics',
      'CSV export',
    ],
    limits: {
      events_created: 15,
      attendees_registered: 1000,
      ai_matching_runs: 200,
      emails_sent: 5000,
      team_members_added: 5,
    },
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    priceMonthly: 499,
    envPriceKey: 'STRIPE_PRICE_AGENCY',
    features: [
      '100 events/month',
      '10,000 attendees/month',
      'White-label pages',
      'Multiple brands',
      'Multiple team members',
      'Priority limits',
    ],
    limits: {
      events_created: 100,
      attendees_registered: 10000,
      ai_matching_runs: 2000,
      emails_sent: 50000,
      team_members_added: 25,
    },
  },
};

export const PAID_PLAN_IDS: PlanId[] = ['starter', 'pro', 'agency'];

export const planFromPriceId = (
  priceId: string,
  prices: { starter: string; pro: string; agency: string },
): PlanId => {
  if (priceId === prices.starter) return 'starter';
  if (priceId === prices.pro) return 'pro';
  if (priceId === prices.agency) return 'agency';
  return 'free';
};
