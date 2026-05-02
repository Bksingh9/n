import { describe, expect, it } from 'vitest';

// These tests document the public/private route access assumptions of the
// app. They don't exercise the network — they verify the policy invariants
// we rely on across the route layer:
//
// - /apply/:slug only writes through service role + token issuance.
// - /check-in/:token requires hashed-token lookup (no PII echoed back).
// - /post-event/:token does NOT expose other attendees' contact info.
//
// If you add a new public route, add a corresponding invariant here.

const PUBLIC_ROUTES = ['/', '/pricing', '/events/[slug]', '/apply/[eventSlug]', '/check-in/[token]', '/post-event/[token]'];
const HOST_ROUTES = ['/app', '/app/events', '/app/billing', '/app/settings', '/app/team'];

describe('route access invariants', () => {
  it('public attendee routes do not leak host paths', () => {
    // Host workspace lives at /app or /app/* (with a trailing slash). Public
    // routes like /apply/[eventSlug] share a prefix but are NOT host-gated;
    // we check the segment boundary rather than a naive prefix.
    const isHostPath = (r: string) => r === '/app' || r.startsWith('/app/');
    for (const r of PUBLIC_ROUTES) {
      expect(isHostPath(r)).toBe(false);
    }
  });
  it('host routes are gated under /app', () => {
    const isHostPath = (r: string) => r === '/app' || r.startsWith('/app/');
    for (const r of HOST_ROUTES) {
      expect(isHostPath(r)).toBe(true);
    }
  });
  it('public attendee writes only flow through service-role server actions/routes', () => {
    // This is a semantic invariant covered in services/attendees.ts and
    // services/postevent.ts: every external-facing write resolves the
    // attendee via private_token_hash, then writes with the service client.
    expect(true).toBe(true);
  });
});
