# DateOps Live

Run real-time singles events with AI-powered matching, live check-in, mutual
matches, and consent-based intros.

DateOps Live is event-host software, not a dating marketplace. It manages host
organizations, subscriptions, event creation, applications, real-time check-in,
rotation generation, post-event interest collection, mutual match detection,
and consent-gated intro emails.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn-style primitives
- Supabase (Auth, Postgres, Realtime, Storage)
- Postgres Row Level Security on every tenant table
- Stripe Checkout, Billing, Customer Portal, Webhooks
- Resend + React Email
- Anthropic SDK (Claude) for compatibility summaries
- Vitest

## Quickstart

```bash
cp .env.example .env.local
# fill in Supabase, Stripe, Resend, Anthropic keys

npm install
# Apply migrations to your Supabase project (or local supabase CLI):
#   supabase db push
# or run /supabase/migrations/0001_init.sql + 0002_rls.sql against your DB.

npm run dev
```

Open http://localhost:3000.

## Environment variables

See `.env.example`. Required:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `ANTHROPIC_API_KEY`
- `APP_URL`, `CRON_SECRET`

> The service-role key, Stripe secret, Resend key, and Anthropic key are
> server-only. They must never end up in client bundles. Anything prefixed
> `NEXT_PUBLIC_` is intended for the browser.

## Migrations

`supabase/migrations/0001_init.sql` defines the schema (organizations,
profiles, events, attendees, rotation_rounds, compatibility_scores,
post_event_interests, mutual_matches, activity_events, usage_events,
email_events) and indexes.

`supabase/migrations/0002_rls.sql` enables Row Level Security on every tenant
table and adds organization-membership policies. Public attendee actions are
intentionally NOT permitted via RLS — they go through server-side routes that
verify a hashed private token before doing controlled writes with the service
role.

## Project layout

```
src/
  app/                      # Next.js App Router
    (auth)/                 # sign-in, sign-up, forgot-password
    onboarding/             # first-run org creation
    app/                    # host workspace (dashboard, events, billing, …)
    events/[slug]/          # public event page
    apply/[eventSlug]/      # public application
    check-in/[token]/       # private QR check-in
    post-event/[token]/     # private interest form
    api/stripe/*            # checkout, portal, webhook
    page.tsx                # landing
  components/               # UI primitives + app components
  emails/                   # React Email templates
  lib/
    auth.ts                 # session + org context helpers
    activity.ts             # createActivityEvent()
    usage.ts                # checkUsage / enforceUsage / recordUsage
    plans.ts                # plan + limit definitions
    stripe.ts               # stripe SDK init
    email/send.ts           # Resend wrappers
    matching/               # deterministic + AI scoring + rotation engine
    services/               # event, attendee, postevent, live services
    supabase/               # server, browser, types
  middleware.ts             # supabase session refresh
supabase/migrations/        # SQL migrations
tests/                      # vitest tests
scripts/seed.ts             # demo data
```

## Plans

| Plan    | Price/mo | Events | Attendees | AI runs | Emails | Team |
|---------|----------|--------|-----------|---------|--------|------|
| Free    | $0       | 1      | 25        | 0       | 50     | 1    |
| Starter | $49      | 3      | 150       | 25      | 500    | 2    |
| Pro     | $149     | 15     | 1,000     | 200     | 5,000  | 5    |
| Agency  | $499     | 100    | 10,000    | 2,000   | 50,000 | 25   |

Limits are enforced server-side in `lib/usage.ts` before any chargeable
operation (event create, attendee accept, AI matching run, email send,
team add). When a limit is hit, a `USAGE_LIMIT_REACHED` activity event is
recorded so hosts can see it on the dashboard.

## Realtime

The host dashboard subscribes to `activity_events` filtered by
`organization_id`; the live event page filters by `event_id`. Sensitive
fields are never put into activity metadata — only IDs and counts.

## Matching & rotations

- `lib/matching/scoring.ts` — pure deterministic compatibility based on
  attendee-provided fields only. No sensitive trait inference; no
  attractiveness ranking.
- `lib/matching/anthropic.ts` — clamps the AI score to ±15 of the
  deterministic baseline and strips PII before sending to Claude.
- `lib/matching/rotation.ts` — speed-dating rotation generator that
  guarantees no duplicate pairings, no double-booking, respects orientation
  conflicts, and uses higher compatibility scores first.

## Mutual matches & consent

A mutual match is recorded when two attendees pick each other on the
post-event page. Intro emails are sent **only** when:

1. Both attendees consented to share contact (`consent_to_share_contact`).
2. Both attendees consented to be contacted at signup (`consent_to_contact`).

Email events are logged in `email_events`.

## Stripe webhook

`/api/stripe/webhook` verifies the signature with `STRIPE_WEBHOOK_SECRET`,
then handles `checkout.session.completed`,
`customer.subscription.created/updated/deleted`. Plan changes are persisted
on `organizations.plan` and emit `SUBSCRIPTION_CHANGED` activity events.

## Testing

```bash
npm run test
```

Test suites cover:

- subscription plan limit math (`tests/usage.test.ts`)
- attendee/event/interest validation (`tests/validation.test.ts`)
- public/private route access invariants (`tests/route-access.test.ts`)
- deterministic compatibility scoring (`tests/scoring.test.ts`)
- rotation generation: no duplicate pairings, no double-booking, conflict
  skipping, odd-headcount rest slots (`tests/rotation.test.ts`)
- mutual match detection + consent gating (`tests/mutual-match.test.ts`)
- AI JSON parsing tolerance (`tests/json-parsing.test.ts`)

## Seeding demo data

```bash
npx tsx scripts/seed.ts
```

Creates a "DateOps Demo" organization, one published event, and four
sample attendees. Safe to re-run.

## Security notes

- Service-role key is never imported into client components.
- Public attendee links are tokenized; only the SHA-256 hash is stored.
- RLS isolates organization data; service-role writes are explicit and
  scoped.
- The Anthropic prompt is locked to a strict JSON schema; outputs are
  clamped to the deterministic baseline ±15.
- The webhook route is excluded from middleware to preserve raw body.
