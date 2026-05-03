// Role + plan-feature gating. Centralizes the answer to "can this user do X?".

import type { PlanId } from '@/lib/plans';

export type Role = 'owner' | 'admin' | 'member';

export const ROLE_RANK: Record<Role, number> = { owner: 3, admin: 2, member: 1 };

export const isAtLeast = (role: string, min: Role): boolean =>
  (ROLE_RANK[role as Role] ?? 0) >= ROLE_RANK[min];

// Plan-feature gates. Keep this as the single source of truth.
export const planFeatures = (plan: PlanId) => ({
  csvExport: plan === 'pro' || plan === 'agency',
  whiteLabel: plan === 'agency',
  multipleBrands: plan === 'agency',
  teamInvites: plan === 'pro' || plan === 'agency',
});
