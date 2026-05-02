-- DateOps Live: RLS policies
-- Tenant isolation: organization members can access their org's data.
-- Public attendee actions are intentionally NOT permitted via RLS;
-- public flows go through server routes that use the service role with
-- explicit allowlists (token verification, scoped writes).

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
alter table public.organizations enable row level security;

drop policy if exists orgs_member_select on public.organizations;
create policy orgs_member_select on public.organizations
  for select using (public.is_org_member(id, auth.uid()));

drop policy if exists orgs_member_update on public.organizations;
create policy orgs_member_update on public.organizations
  for update using (public.is_org_member(id, auth.uid()))
  with check (public.is_org_member(id, auth.uid()));

-- Inserts go through server-side createOrganization (service role).

-- ----------------------------------------------------------------------------
-- organization_members
-- ----------------------------------------------------------------------------
alter table public.organization_members enable row level security;

drop policy if exists members_self_or_org_select on public.organization_members;
create policy members_self_or_org_select on public.organization_members
  for select using (
    user_id = auth.uid() or public.is_org_member(organization_id, auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Generic tenant policies: helper macro pattern repeated per table.
-- ----------------------------------------------------------------------------

-- events
alter table public.events enable row level security;
drop policy if exists events_member_all on public.events;
create policy events_member_all on public.events
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- event_questions
alter table public.event_questions enable row level security;
drop policy if exists eq_member_all on public.event_questions;
create policy eq_member_all on public.event_questions
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- attendees
alter table public.attendees enable row level security;
drop policy if exists attendees_member_all on public.attendees;
create policy attendees_member_all on public.attendees
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- attendee_answers
alter table public.attendee_answers enable row level security;
drop policy if exists aa_member_all on public.attendee_answers;
create policy aa_member_all on public.attendee_answers
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- compatibility_scores
alter table public.compatibility_scores enable row level security;
drop policy if exists compat_member_all on public.compatibility_scores;
create policy compat_member_all on public.compatibility_scores
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- rotation_rounds
alter table public.rotation_rounds enable row level security;
drop policy if exists rotation_member_all on public.rotation_rounds;
create policy rotation_member_all on public.rotation_rounds
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- post_event_interests
alter table public.post_event_interests enable row level security;
drop policy if exists interest_member_all on public.post_event_interests;
create policy interest_member_all on public.post_event_interests
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- mutual_matches
alter table public.mutual_matches enable row level security;
drop policy if exists mutual_member_all on public.mutual_matches;
create policy mutual_member_all on public.mutual_matches
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- activity_events
alter table public.activity_events enable row level security;
drop policy if exists activity_member_select on public.activity_events;
create policy activity_member_select on public.activity_events
  for select using (public.is_org_member(organization_id, auth.uid()));
-- Inserts go through server-side createActivityEvent (service role).

-- usage_events
alter table public.usage_events enable row level security;
drop policy if exists usage_member_select on public.usage_events;
create policy usage_member_select on public.usage_events
  for select using (public.is_org_member(organization_id, auth.uid()));

-- email_events
alter table public.email_events enable row level security;
drop policy if exists email_member_select on public.email_events;
create policy email_member_select on public.email_events
  for select using (public.is_org_member(organization_id, auth.uid()));
