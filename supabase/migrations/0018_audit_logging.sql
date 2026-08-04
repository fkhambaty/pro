-- Audit logging for admins.
--
-- Logical age partitions (sliding windows) as views + one admin RPC.
-- True Postgres RANGE partitions do not map cleanly to "last 7 / 8–14 / …"
-- windows that move every day; exclusive age buckets do.

-- ---------------------------------------------------------------------------
-- Indexes for time-bucket queries
-- ---------------------------------------------------------------------------

create index if not exists audit_events_created_idx
  on audit_events (created_at desc);

create index if not exists audit_events_action_idx
  on audit_events (action, created_at desc);

-- ---------------------------------------------------------------------------
-- Authenticated users may append their own actions (never spoof actor_id)
-- ---------------------------------------------------------------------------

create or replace function write_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Not signed in';
  end if;

  if p_action is null or length(trim(p_action)) = 0 then
    raise exception 'action is required';
  end if;

  if p_entity_type is null or length(trim(p_entity_type)) = 0 then
    raise exception 'entity_type is required';
  end if;

  insert into audit_events (actor_id, entity_type, entity_id, action, detail)
  values (
    actor,
    trim(p_entity_type),
    coalesce(p_entity_id, actor),
    trim(p_action),
    coalesce(p_detail, '{}'::jsonb)
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function write_audit_event(text, text, uuid, jsonb) from public;
grant execute on function write_audit_event(text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Exclusive age buckets (logical partitions)
--   7d    → last 7 days
--   14d   → 7–14 days ago
--   30d   → 14–30 days ago
--   older → older than 30 days
-- ---------------------------------------------------------------------------

create or replace view audit_events_7d
with (security_invoker = true)
as
select *
from audit_events
where created_at >= now() - interval '7 days';

create or replace view audit_events_14d
with (security_invoker = true)
as
select *
from audit_events
where created_at < now() - interval '7 days'
  and created_at >= now() - interval '14 days';

create or replace view audit_events_30d
with (security_invoker = true)
as
select *
from audit_events
where created_at < now() - interval '14 days'
  and created_at >= now() - interval '30 days';

create or replace view audit_events_older
with (security_invoker = true)
as
select *
from audit_events
where created_at < now() - interval '30 days';

grant select on audit_events_7d to authenticated;
grant select on audit_events_14d to authenticated;
grant select on audit_events_30d to authenticated;
grant select on audit_events_older to authenticated;

-- ---------------------------------------------------------------------------
-- Admin list + counts per bucket
-- ---------------------------------------------------------------------------

create or replace function admin_audit_bucket_counts()
returns table (
  bucket text,
  event_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  return query
  select '7d'::text, count(*) from audit_events where created_at >= now() - interval '7 days'
  union all
  select '14d', count(*) from audit_events
    where created_at < now() - interval '7 days'
      and created_at >= now() - interval '14 days'
  union all
  select '30d', count(*) from audit_events
    where created_at < now() - interval '14 days'
      and created_at >= now() - interval '30 days'
  union all
  select 'older', count(*) from audit_events where created_at < now() - interval '30 days';
end;
$$;

revoke all on function admin_audit_bucket_counts() from public;
grant execute on function admin_audit_bucket_counts() to authenticated;

create or replace function admin_list_audit_events(
  p_bucket text default '7d',
  p_limit integer default 200,
  p_offset integer default 0
)
returns table (
  id uuid,
  actor_id uuid,
  actor_name text,
  actor_email text,
  actor_role text,
  entity_type text,
  entity_id uuid,
  action text,
  detail jsonb,
  created_at timestamptz,
  age_bucket text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer := greatest(1, least(coalesce(p_limit, 200), 500));
  off integer := greatest(0, coalesce(p_offset, 0));
  bucket text := lower(coalesce(p_bucket, '7d'));
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  if bucket not in ('7d', '14d', '30d', 'older') then
    raise exception 'Invalid bucket';
  end if;

  return query
  select
    e.id,
    e.actor_id,
    p.full_name,
    p.email,
    p.role::text,
    e.entity_type,
    e.entity_id,
    e.action,
    e.detail,
    e.created_at,
    bucket
  from audit_events e
  left join profiles p on p.id = e.actor_id
  where
    case bucket
      when '7d' then e.created_at >= now() - interval '7 days'
      when '14d' then
        e.created_at < now() - interval '7 days'
        and e.created_at >= now() - interval '14 days'
      when '30d' then
        e.created_at < now() - interval '14 days'
        and e.created_at >= now() - interval '30 days'
      else e.created_at < now() - interval '30 days'
    end
  order by e.created_at desc
  limit lim
  offset off;
end;
$$;

revoke all on function admin_list_audit_events(text, integer, integer) from public;
grant execute on function admin_list_audit_events(text, integer, integer) to authenticated;

-- Admins need email on profiles for the audit actor column (column grant was
-- revoked for authenticated in 0007). Service-definer RPC already bypasses
-- that; no extra grant required.
