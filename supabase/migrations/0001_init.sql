-- DateOps Live: initial schema
-- Idempotent-ish migration. Tables + indexes + helper functions.
-- RLS policies live in 0002_rls.sql.

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles: 1:1 with auth.users
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  brand_tone text,
  city text,
  contact_email text,
  event_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_plan_idx on public.organizations(plan);
create index if not exists organizations_stripe_customer_idx on public.organizations(stripe_customer_id);

-- ----------------------------------------------------------------------------
-- organization_members
-- ----------------------------------------------------------------------------
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists org_members_org_idx on public.organization_members(organization_id);
create index if not exists org_members_user_idx on public.organization_members(user_id);

-- Helper: check if a user is a member of an org. SECURITY DEFINER avoids
-- recursive RLS evaluation when used inside policies.
create or replace function public.is_org_member(p_org uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org and user_id = p_user
  );
$$;

-- ----------------------------------------------------------------------------
-- events
-- ----------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  host_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  event_type text,
  venue_name text,
  city text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft',
  public_slug text unique,
  age_min integer,
  age_max integer,
  max_attendees integer,
  application_deadline timestamptz,
  relationship_goal text,
  current_round integer default 0,
  round_started_at timestamptz,
  round_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_org_idx on public.events(organization_id);
create index if not exists events_status_idx on public.events(status);
create index if not exists events_starts_idx on public.events(starts_at);

-- ----------------------------------------------------------------------------
-- event_questions
-- ----------------------------------------------------------------------------
create table if not exists public.event_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  question text not null,
  type text not null default 'text',
  options jsonb,
  required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists event_questions_event_idx on public.event_questions(event_id);

-- ----------------------------------------------------------------------------
-- attendees
-- ----------------------------------------------------------------------------
create table if not exists public.attendees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  age integer,
  gender text,
  interested_in text,
  relationship_goal text,
  bio text,
  hobbies text,
  conversation_topics text,
  dealbreakers text,
  preferred_age_min integer,
  preferred_age_max integer,
  status text not null default 'applied',
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  consent_to_contact boolean not null default false,
  safety_flag boolean not null default false,
  private_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attendees_org_idx on public.attendees(organization_id);
create index if not exists attendees_event_status_idx on public.attendees(event_id, status);
create index if not exists attendees_token_idx on public.attendees(private_token_hash);
create unique index if not exists attendees_event_email_idx on public.attendees(event_id, lower(email)) where email is not null;

-- ----------------------------------------------------------------------------
-- attendee_answers
-- ----------------------------------------------------------------------------
create table if not exists public.attendee_answers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  question_id uuid not null references public.event_questions(id) on delete cascade,
  answer text,
  created_at timestamptz not null default now()
);

create index if not exists attendee_answers_attendee_idx on public.attendee_answers(attendee_id);
create index if not exists attendee_answers_event_idx on public.attendee_answers(event_id);

-- ----------------------------------------------------------------------------
-- compatibility_scores
-- ----------------------------------------------------------------------------
create table if not exists public.compatibility_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_a_id uuid not null references public.attendees(id) on delete cascade,
  attendee_b_id uuid not null references public.attendees(id) on delete cascade,
  score integer not null,
  summary text,
  reasons jsonb,
  preference_conflict boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, attendee_a_id, attendee_b_id)
);

create index if not exists compat_event_idx on public.compatibility_scores(event_id);
create index if not exists compat_pair_idx on public.compatibility_scores(event_id, attendee_a_id, attendee_b_id);

-- ----------------------------------------------------------------------------
-- rotation_rounds
-- ----------------------------------------------------------------------------
create table if not exists public.rotation_rounds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  round_number integer not null,
  table_number integer not null,
  attendee_a_id uuid references public.attendees(id) on delete cascade,
  attendee_b_id uuid references public.attendees(id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create index if not exists rotation_event_round_idx on public.rotation_rounds(event_id, round_number);
create index if not exists rotation_event_idx on public.rotation_rounds(event_id);

-- ----------------------------------------------------------------------------
-- post_event_interests
-- ----------------------------------------------------------------------------
create table if not exists public.post_event_interests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  from_attendee_id uuid not null references public.attendees(id) on delete cascade,
  to_attendee_id uuid not null references public.attendees(id) on delete cascade,
  interest_type text not null,
  consent_to_share_contact boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, from_attendee_id, to_attendee_id)
);

create index if not exists interest_event_idx on public.post_event_interests(event_id);
create index if not exists interest_to_idx on public.post_event_interests(event_id, to_attendee_id);

-- ----------------------------------------------------------------------------
-- mutual_matches
-- ----------------------------------------------------------------------------
create table if not exists public.mutual_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_a_id uuid not null references public.attendees(id) on delete cascade,
  attendee_b_id uuid not null references public.attendees(id) on delete cascade,
  match_type text not null,
  intro_email_sent boolean not null default false,
  intro_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, attendee_a_id, attendee_b_id)
);

create index if not exists mutual_event_idx on public.mutual_matches(event_id);

-- ----------------------------------------------------------------------------
-- activity_events
-- ----------------------------------------------------------------------------
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  actor_type text,
  actor_id uuid,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_event_time_idx on public.activity_events(event_id, created_at desc);
create index if not exists activity_org_time_idx on public.activity_events(organization_id, created_at desc);

-- ----------------------------------------------------------------------------
-- usage_events
-- ----------------------------------------------------------------------------
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  quantity integer not null default 1,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_org_type_time_idx on public.usage_events(organization_id, event_type, created_at);

-- ----------------------------------------------------------------------------
-- email_events
-- ----------------------------------------------------------------------------
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  recipient_email text,
  email_type text,
  status text,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists email_org_time_idx on public.email_events(organization_id, created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orgs_updated on public.organizations;
create trigger trg_orgs_updated before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_events_updated on public.events;
create trigger trg_events_updated before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists trg_attendees_updated on public.attendees;
create trigger trg_attendees_updated before update on public.attendees
  for each row execute function public.set_updated_at();

-- Auto-create profile when an auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
