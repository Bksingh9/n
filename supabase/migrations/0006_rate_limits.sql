-- Sliding-window rate limit buckets. One row per (key, window_start).
-- The key encodes the action + a salted identifier (event/ip/token-hash),
-- so different actions can have different limits without sharing state.

create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  bucket_key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (bucket_key, window_start)
);

create index if not exists rate_limits_key_window_idx
  on public.rate_limits(bucket_key, window_start desc);

-- Rate limit rows are infrastructure; never user-facing.
alter table public.rate_limits enable row level security;
-- No policies = no row access via PostgREST. Service role bypasses RLS.
