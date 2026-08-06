-- Lean, Postgres-backed edge rate limits.
--
-- This is deliberately small-scale infrastructure. Redis is only justified
-- when measured contention or throughput requires it.

create table if not exists private.edge_rate_limits (
  bucket_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_hash, window_start)
);

create index if not exists edge_rate_limits_updated_idx
  on private.edge_rate_limits (updated_at);

create or replace function consume_edge_rate_limit(
  p_bucket_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_bucket_hash is null or length(p_bucket_hash) < 16 then
    raise exception 'Invalid rate-limit bucket';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'Invalid rate-limit limit';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit window';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into private.edge_rate_limits (
    bucket_hash,
    window_start,
    request_count,
    updated_at
  )
  values (p_bucket_hash, v_window, 1, now())
  on conflict (bucket_hash, window_start)
  do update
     set request_count = private.edge_rate_limits.request_count + 1,
         updated_at = now()
  returning request_count into v_count;

  -- Opportunistic cleanup keeps this low-volume table bounded without cron.
  if random() < 0.01 then
    delete from private.edge_rate_limits
     where updated_at < now() - interval '2 days';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on function consume_edge_rate_limit(text, integer, integer) from public;
revoke all on function consume_edge_rate_limit(text, integer, integer) from anon;
revoke all on function consume_edge_rate_limit(text, integer, integer) from authenticated;
grant execute on function consume_edge_rate_limit(text, integer, integer) to service_role;
