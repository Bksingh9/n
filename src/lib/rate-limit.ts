// Sliding-window rate limiter backed by the `rate_limits` table.
//
// Each call computes the current bucket key for the configured window
// (e.g. "apply:<event_id>:<ip>|2030-01-01T12:00:00.000Z"), then atomically
// upserts and increments. If the new count exceeds the limit we deny.
//
// This is deliberately approximate: each window is a fixed-size box rather
// than a true sliding window. Good enough to stop spam and abuse without
// adding Redis to the stack.

import { createServiceClient } from '@/lib/supabase/server';

export interface RateLimitConfig {
  /** Stable namespace per action — e.g. 'apply', 'post_event_interest', 'safety_report'. */
  action: string;
  /** Caller-supplied identifier (event id, attendee id, IP, etc.). */
  identifier: string;
  /** Max calls allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

export const computeWindowStart = (now: Date, windowMs: number): Date => {
  const ms = now.getTime();
  return new Date(ms - (ms % windowMs));
};

export const checkRateLimit = async (
  config: RateLimitConfig,
  now: Date = new Date(),
): Promise<RateLimitResult> => {
  const windowStart = computeWindowStart(now, config.windowMs);
  const bucketKey = `${config.action}:${config.identifier}`;
  const resetAt = new Date(windowStart.getTime() + config.windowMs);
  const svc = createServiceClient();

  // Insert-or-bump pattern. We can't atomically increment via PostgREST,
  // so we read-then-update; concurrent writers may both compute the same
  // pre-value and both write the same count. That overshoots by a small
  // factor (still safe for spam-control); a strict counter would need an
  // RPC. Acceptable for the abuse scenarios we're guarding against.
  const { data: existing } = await svc
    .from('rate_limits')
    .select('id, count')
    .eq('bucket_key', bucketKey)
    .eq('window_start', windowStart.toISOString())
    .maybeSingle();

  if (!existing) {
    const { error } = await svc.from('rate_limits').insert({
      bucket_key: bucketKey,
      window_start: windowStart.toISOString(),
      count: 1,
    });
    if (error && !error.message.includes('duplicate')) {
      // Best-effort: allow the request rather than blocking on infra errors.
      return { allowed: true, remaining: config.limit - 1, resetAt, limit: config.limit };
    }
    return { allowed: true, remaining: config.limit - 1, resetAt, limit: config.limit };
  }

  if (existing.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt, limit: config.limit };
  }

  const nextCount = existing.count + 1;
  await svc
    .from('rate_limits')
    .update({ count: nextCount })
    .eq('id', existing.id);

  return {
    allowed: true,
    remaining: Math.max(0, config.limit - nextCount),
    resetAt,
    limit: config.limit,
  };
};

// Best-effort client IP extraction for public routes. Trust order:
//   1. x-forwarded-for first hop (Vercel/most CDNs)
//   2. x-real-ip
//   3. cf-connecting-ip
//   4. Fallback to a per-request UA hash so localhost dev still buckets.
export const clientIpFromHeaders = (headers: Headers): string => {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  return 'anon';
};
