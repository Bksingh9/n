-- Geocode result cache on events. Fail-open: if geocoding fails the event
-- still saves; geocoded_at NULL just means "not yet resolved".

alter table public.events
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geocoded_at timestamptz,
  add column if not exists geocode_label text;

create index if not exists events_geo_idx on public.events(latitude, longitude);
