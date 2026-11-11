-- Hotel content store. Written by the sync script and read by the server with the
-- service role key. Row-level security is on and there are no public policies, so
-- the anon and authenticated roles see nothing.

create table if not exists hotels (
  hid bigint primary key,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  star_rating smallint,
  kind text,
  region_id bigint,
  region_name text,
  country_code text,
  time_zone text,
  check_in_time text,
  check_out_time text,
  images jsonb not null default '[]',
  amenity_groups jsonb not null default '[]',
  description jsonb not null default '[]',
  metapolicy_struct jsonb,
  metapolicy_extra_info text,
  review_rating numeric(3,1),
  review_detailed jsonb,
  synced_at timestamptz not null
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);

create table if not exists missing_hotels (
  hid bigint primary key,
  first_seen timestamptz not null default now()
);

alter table hotels enable row level security;
alter table settings enable row level security;
alter table missing_hotels enable row level security;

-- Placeholder markup until the real figure is set (spec section 13, item 6).
insert into settings (key, value) values ('markup_percent', '12')
on conflict (key) do nothing;
