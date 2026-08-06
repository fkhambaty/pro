-- Provider references, idempotent settlement, webhook ledger, and operations.

alter table payments
  add column if not exists provider_order_id text,
  add column if not exists provider_payment_id text,
  add column if not exists failure_code text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists payments_provider_order_key
  on payments (provider, provider_order_id)
  where provider_order_id is not null;
create unique index if not exists payments_provider_payment_key
  on payments (provider, provider_payment_id)
  where provider_payment_id is not null;
create index if not exists payments_pending_recent_idx
  on payments (profile_id, purpose, created_at desc)
  where status = 'pending';

create table if not exists payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_order_id text,
  provider_payment_id text,
  payment_id uuid references payments(id),
  status text not null default 'received'
    check (status in ('received', 'processed', 'ignored', 'failed')),
  detail jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

alter table payment_provider_events enable row level security;

create table if not exists ops_events (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  category text not null,
  code text not null,
  summary text not null,
  entity_type text,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ops_events_open_idx
  on ops_events (severity, created_at desc)
  where resolved_at is null;
alter table ops_events enable row level security;
drop policy if exists ops_events_admin_read on ops_events;
create policy ops_events_admin_read on ops_events
  for select to authenticated using (is_admin());

create or replace function settle_provider_payment(
  p_payment_id uuid,
  p_provider text,
  p_order_id text,
  p_provider_payment_id text,
  p_amount_cents integer,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row payments%rowtype;
begin
  select * into payment_row from payments where id = p_payment_id for update;
  if not found then return 'unknown'; end if;
  if payment_row.status = 'paid' then
    if payment_row.provider_payment_id is distinct from p_provider_payment_id then
      raise exception 'Payment already settled with a different provider payment';
    end if;
    return 'already_paid';
  end if;
  if payment_row.status is distinct from 'pending' then
    raise exception 'Payment is not pending';
  end if;
  if payment_row.provider is distinct from p_provider then
    raise exception 'Payment provider mismatch';
  end if;
  if payment_row.provider_order_id is distinct from p_order_id then
    raise exception 'Payment order mismatch';
  end if;
  if payment_row.amount_cents is distinct from p_amount_cents
     or upper(payment_row.currency) is distinct from upper(p_currency) then
    insert into ops_events (
      severity, category, code, summary, entity_type, entity_id, detail
    ) values (
      'critical', 'payments', 'provider_amount_mismatch',
      'Provider payment amount or currency did not match the order',
      'payment', payment_row.id::text,
      jsonb_build_object(
        'expected_amount', payment_row.amount_cents,
        'received_amount', p_amount_cents,
        'expected_currency', payment_row.currency,
        'received_currency', upper(p_currency)
      )
    );
    return 'mismatch';
  end if;

  update payments
     set status = 'paid',
         paid_at = coalesce(paid_at, now()),
         provider_payment_id = p_provider_payment_id,
         provider_reference = p_provider_payment_id,
         updated_at = now()
   where id = payment_row.id;

  return 'settled';
end;
$$;

revoke all on function settle_provider_payment(uuid, text, text, text, integer, text) from public;
grant execute on function settle_provider_payment(uuid, text, text, text, integer, text) to service_role;

create or replace function admin_operations_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when is_admin() then jsonb_build_object(
    'pending_payments', (
      select count(*) from payments
       where status = 'pending' and created_at < now() - interval '30 minutes'
    ),
    'failed_events_24h', (
      select count(*) from payment_provider_events
       where status = 'failed' and received_at > now() - interval '24 hours'
    ),
    'open_critical_events', (
      select count(*) from ops_events
       where severity = 'critical' and resolved_at is null
    ),
    'identity_documents_due', (
      select count(*) from identity_verifications
       where expires_at is not null
         and expires_at <= current_date
         and (document_storage_path is not null or selfie_storage_path is not null)
    ),
    'checked_at', now()
  ) else null end;
$$;

revoke all on function admin_operations_health() from public;
grant execute on function admin_operations_health() to authenticated;

create or replace function admin_operations_events(p_limit integer default 100)
returns setof ops_events
language sql
stable
security definer
set search_path = public
as $$
  select o.*
    from ops_events o
   where is_admin()
   order by o.created_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function admin_operations_events(integer) from public;
grant execute on function admin_operations_events(integer) to authenticated;
