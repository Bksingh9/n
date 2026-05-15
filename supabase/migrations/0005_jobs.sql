-- Background job queue. Producers enqueue from server actions; the cron
-- worker route at /api/cron/jobs claims and executes them.
--
-- Concurrency: workers claim rows via `update ... where id = any(select id
-- ... limit N for update skip locked)` semantics implemented in the service
-- using an atomic "running" status flip with a check on attempts.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_run_at timestamptz not null default now(),
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists jobs_status_run_idx on public.jobs(status, next_run_at);
create index if not exists jobs_org_kind_idx on public.jobs(organization_id, kind, created_at desc);

alter table public.jobs enable row level security;
drop policy if exists jobs_member_select on public.jobs;
create policy jobs_member_select on public.jobs
  for select using (
    organization_id is null
    or public.is_org_member(organization_id, auth.uid())
  );
-- Inserts + updates flow through service-role workers only.
