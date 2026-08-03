-- First-party web analytics.
--
-- Visits are written by an edge function using the service role, so the
-- browser can never insert or read them. Admins read aggregates only.
--
-- No raw IP address is ever stored. The visitor id is a daily salted hash of
-- IP + user agent, which is enough to count unique people without being able
-- to identify one.

create table if not exists site_visits (
  id bigint generated always as identity primary key,
  visited_at timestamptz not null default now(),

  -- Who (pseudonymous)
  visitor_id text not null,
  session_id text not null,
  is_new_visitor boolean not null default true,

  -- Where on the site
  path text not null,
  query text,

  -- Where they came from
  referrer_host text,
  referrer_url text,
  channel text not null default 'direct',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,

  -- Where in the world
  country text,
  region text,
  city text,
  timezone text,

  -- What they used
  device text,
  os text,
  browser text,
  screen_width integer,
  language text,

  -- Who they are, if signed in
  profile_id uuid references profiles (id) on delete set null
);

create index if not exists site_visits_time_idx on site_visits (visited_at desc);
create index if not exists site_visits_visitor_idx on site_visits (visitor_id, visited_at desc);
create index if not exists site_visits_channel_idx on site_visits (channel, visited_at desc);

alter table site_visits enable row level security;

-- No policy for anon or authenticated: every write and read goes through the
-- service role or the admin views below.
drop policy if exists site_visits_admin_read on site_visits;

create policy site_visits_admin_read on site_visits
  for select to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- Aggregates the admin console reads
-- ---------------------------------------------------------------------------

create or replace function analytics_overview(days integer default 30)
returns table (
  page_views bigint,
  unique_visitors bigint,
  sessions bigint,
  new_visitors bigint,
  countries bigint,
  signed_in_views bigint
)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    count(distinct visitor_id)::bigint,
    count(distinct session_id)::bigint,
    count(distinct visitor_id) filter (where is_new_visitor)::bigint,
    count(distinct country)::bigint,
    count(*) filter (where profile_id is not null)::bigint
  from site_visits
  where is_admin()
    and visited_at >= now() - make_interval(days => days);
$$;

create or replace function analytics_breakdown(
  dimension text,
  days integer default 30,
  max_rows integer default 12
)
returns table (label text, views bigint, visitors bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Admins only';
  end if;

  -- Whitelisted so the caller cannot name an arbitrary column.
  if dimension not in (
    'channel', 'referrer_host', 'country', 'city', 'device', 'browser',
    'os', 'path', 'utm_source', 'utm_campaign', 'language'
  ) then
    raise exception 'Unknown dimension %', dimension;
  end if;

  return query execute format($q$
    select
      coalesce(nullif(%I::text, ''), 'Unknown') as label,
      count(*)::bigint as views,
      count(distinct visitor_id)::bigint as visitors
    from site_visits
    where visited_at >= now() - make_interval(days => $1)
    group by 1
    order by views desc
    limit $2
  $q$, dimension) using days, max_rows;
end;
$$;

create or replace function analytics_daily(days integer default 30)
returns table (day date, views bigint, visitors bigint)
language sql
security definer
set search_path = public
as $$
  select
    visited_at::date as day,
    count(*)::bigint,
    count(distinct visitor_id)::bigint
  from site_visits
  where is_admin()
    and visited_at >= now() - make_interval(days => days)
  group by 1
  order by 1;
$$;

grant execute on function analytics_overview(integer) to authenticated;
grant execute on function analytics_breakdown(text, integer, integer) to authenticated;
grant execute on function analytics_daily(integer) to authenticated;
