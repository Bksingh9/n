-- DateOps Live: brands, invites, plan-aware roles, reminder bookkeeping.

-- ---------------------------------------------------------------------------
-- brands: white-label units inside an organization (Agency plan).
-- ---------------------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  tagline text,
  primary_color text,
  logo_url text,
  support_email text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists brands_org_idx on public.brands(organization_id);

drop trigger if exists trg_brands_updated on public.brands;
create trigger trg_brands_updated before update on public.brands
  for each row execute function public.set_updated_at();

-- Each event optionally references a brand. Null = use the org's default.
alter table public.events add column if not exists brand_id uuid references public.brands(id) on delete set null;
create index if not exists events_brand_idx on public.events(brand_id);

-- ---------------------------------------------------------------------------
-- organization_invites: pending invites accepted via secure token.
-- ---------------------------------------------------------------------------
create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  token_hash text not null,
  status text not null default 'pending',
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (organization_id, lower(email))
);

create index if not exists invites_org_idx on public.organization_invites(organization_id);
create index if not exists invites_token_idx on public.organization_invites(token_hash);

alter table public.organization_invites enable row level security;
drop policy if exists invites_member_select on public.organization_invites;
create policy invites_member_select on public.organization_invites
  for select using (public.is_org_member(organization_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- Reminder bookkeeping on events.
-- We track whether reminder + post-event emails have been dispatched so the
-- cron is idempotent.
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_1h_sent_at timestamptz,
  add column if not exists post_event_links_sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- RLS for brands
-- ---------------------------------------------------------------------------
alter table public.brands enable row level security;
drop policy if exists brands_member_all on public.brands;
create policy brands_member_all on public.brands
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
