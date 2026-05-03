-- Safety reports: lightweight, attendee-submitted concerns about another
-- attendee or general event safety. Hosts review at /app/events/<id>/safety.
--
-- Submissions go through a public server action that authenticates the
-- reporter via their hashed private token. Service-role writes only.

create table if not exists public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  reporter_attendee_id uuid references public.attendees(id) on delete set null,
  reported_attendee_id uuid references public.attendees(id) on delete set null,
  category text not null,
  details text,
  status text not null default 'open',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create index if not exists safety_event_idx on public.safety_reports(event_id, created_at desc);
create index if not exists safety_org_status_idx on public.safety_reports(organization_id, status, created_at desc);

alter table public.safety_reports enable row level security;
drop policy if exists safety_member_select on public.safety_reports;
create policy safety_member_select on public.safety_reports
  for select using (public.is_org_member(organization_id, auth.uid()));
drop policy if exists safety_member_update on public.safety_reports;
create policy safety_member_update on public.safety_reports
  for update using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
-- Inserts go through server-side reportSafetyConcern (service role).
