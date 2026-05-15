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

## White-label brands (Agency)

Agency workspaces can run multiple brands inside one organization. Each event
optionally points to a brand; the public event page picks up the brand's
logo, primary color, and tagline. Manage brands at `/app/brands`. Plan
gating + role gating (`admin` minimum) is enforced on every server action.

## Team invites

Pro and Agency plans can invite teammates as `admin` or `member` from
`/app/team`. Invites are tokenized (only the SHA-256 hash is stored), expire
after 14 days, and counted against the `team_members_added` quota. Invitees
receive an email and accept at `/invites/[token]`; a mismatched email or
expired link surfaces a clear error.

## CSV export (Pro+)

`/api/events/[eventId]/export?kind=attendees|matches|emails` streams a CSV
download. Plan gating is server-enforced; lower plans receive a 403.

## Cron-driven reminders

`/api/cron/reminders` is invoked by Vercel Cron every 15 minutes
(`vercel.json`). It dispatches:

- 24-hour reminder emails for events starting in 23-25h
- 1-hour reminder emails for events starting in 30-90 minutes
- Post-event interest links for events that ended in the last 6 hours

Each reminder tier is idempotent: the `reminder_24h_sent_at` /
`reminder_1h_sent_at` / `post_event_links_sent_at` timestamps are written
before per-attendee dispatch, so retries do not double-send. Each reminder
also reissues the attendee's private token for a fresh check-in /
post-event link. Authorization is via `Authorization: Bearer ${CRON_SECRET}`.

## Custom application questions

Hosts can add per-event questions of type `text`, `textarea`, `select`, or
`multi_select` from `/app/events/<id>/questions`. Required questions are
enforced server-side on submit. Answers are stored in `attendee_answers` and
shown on the per-attendee detail page at
`/app/events/<id>/attendees/<attendeeId>`.

## Safety reports

Attendees access a private reporting form at `/report/<token>` (linked from
their check-in and post-event pages). Reports are authenticated via the
attendee's hashed private token, rate-limited to 5 per attendee per event
per 24 hours, and routed to `/app/events/<id>/safety` for host review.
Resolving a report can optionally toggle the reported attendee's
`safety_flag`. Only owners + admins can resolve.

## One-click demo

Empty dashboards show a "Create demo event" card. The demo seeder publishes
an event, drops in six diverse sample attendees with varied preferences,
adds a sample custom question, runs deterministic compatibility scoring,
and generates a 4-round / 3-table rotation. Plan + usage limits still
apply, so the host sees real-world behavior.

## PII redaction before AI calls

`src/lib/pii.ts` centralizes PII scrubbing applied to any attendee data
before it is sent to a third-party model. The redactor strips emails,
phone numbers, URLs, `@handles`, and any caller-supplied "extras" like an
attendee's last name. `redactAttendeeForAi()` wraps it for the standard
attendee shape: first names collapse to an initial, last names / email /
phone are dropped entirely, and free-text fields are scrubbed.

Used by `lib/matching/anthropic.ts`. Add new AI features by composing
`redactAttendeeForAi()` rather than re-implementing the rules.

## Background job queue

`jobs` table + `lib/services/jobs.ts` (producer) +
`lib/services/job-handlers.ts` (worker dispatch). Workers claim batches
via a conditional `status='pending' → 'running'` update so concurrent
workers don't double-claim. Failed jobs retry with exponential backoff
(2m → 4m → 8m → … capped at 1h) up to `max_attempts` (default 5), then
move to `dead`.

`/api/cron/jobs` runs every minute via `vercel.json` and processes up to
50 jobs per invocation, authorized by `Authorization: Bearer ${CRON_SECRET}`.

Producers in use today:

- Mutual-match intro emails — enqueued by `detectMutualMatch` so the
  attendee-facing request stays fast and a Resend hiccup doesn't break
  the consent flow.
- 24h / 1h event reminders — `dispatchReminders` enqueues one job per
  attendee instead of sending inline.
- Post-event interest links — same model as reminders.

Add a new job kind by extending `JobKind` and `runJob()` in
`job-handlers.ts`.

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
