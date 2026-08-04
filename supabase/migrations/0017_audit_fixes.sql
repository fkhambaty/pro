-- Audit fixes: identity submit stuck, marketplace bid/lock visibility,
-- milestone accept guard, change-order snapshot.

-- ---------------------------------------------------------------------------
-- 1. Developers may self-submit identity / interview (not self-approve)
-- ---------------------------------------------------------------------------

create or replace function protect_developer_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if is_admin() then
    return new;
  end if;

  if auth.uid() is distinct from old.profile_id then
    raise exception 'Not allowed to update this developer profile';
  end if;

  -- Self-service: only not_started|rejected → submitted. Never approve yourself.
  if new.identity_status is distinct from old.identity_status then
    if not (
      old.identity_status in ('not_started', 'rejected')
      and new.identity_status = 'submitted'
    ) then
      new.identity_status := old.identity_status;
    end if;
  end if;

  if new.interview_status is distinct from old.interview_status then
    if not (
      old.interview_status in ('not_started', 'rejected')
      and new.interview_status = 'submitted'
    ) then
      new.interview_status := old.interview_status;
    end if;
  end if;

  new.tier := old.tier;
  new.bidding_unlocked_at := old.bidding_unlocked_at;
  new.contracts_delivered := old.contracts_delivered;
  new.first_pass_acceptance := old.first_pass_acceptance;
  new.disputes_lost := old.disputes_lost;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Marketplace lock metadata (no party-only blind spot for developers)
-- ---------------------------------------------------------------------------

create or replace view public.project_locks
with (security_invoker = false)
as
select
  c.project_id,
  c.lock_reference,
  c.locked_at,
  c.warranty_days,
  c.developer_signed_at,
  c.status as contract_status
from contracts c
where c.locked_at is not null;

grant select on public.project_locks to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Marketplace bid aggregates (hide identities, show count + lowest)
-- ---------------------------------------------------------------------------

create or replace view public.project_bid_stats
with (security_invoker = false)
as
select
  b.project_id,
  count(*)::integer as bid_count,
  min(b.amount_cents)::bigint as lowest_bid_cents
from bids b
group by b.project_id;

grant select on public.project_bid_stats to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Accept milestone only from submitted (no client bypass to released)
-- ---------------------------------------------------------------------------

create or replace function accept_milestone(p_milestone_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m milestones%rowtype;
  c contracts%rowtype;
begin
  select * into m from milestones where id = p_milestone_id for update;
  if not found then
    raise exception 'Milestone not found';
  end if;

  select * into c from contracts where id = m.contract_id;
  if c.buyer_id is distinct from auth.uid() and not is_admin() then
    raise exception 'Only the buyer can accept this milestone';
  end if;

  if m.status is distinct from 'submitted' then
    raise exception 'Milestone must be submitted before it can be accepted';
  end if;

  update milestones
  set
    status = 'released',
    accepted_at = now(),
    released_at = now()
  where id = p_milestone_id;
end;
$$;

revoke all on function accept_milestone(uuid) from public;
grant execute on function accept_milestone(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Snapshot helper for change orders (reuse freeze snapshot shape)
-- ---------------------------------------------------------------------------

create or replace function snapshot_scope_for_contract(p_contract_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(si) order by si.position), '[]'::jsonb)
  into result
  from scope_items si
  join contracts c on c.project_id = si.project_id
  where c.id = p_contract_id;

  return result;
end;
$$;

revoke all on function snapshot_scope_for_contract(uuid) from public;
grant execute on function snapshot_scope_for_contract(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Unconsumed posting-fee credit (avoid double Razorpay on retry)
-- ---------------------------------------------------------------------------

create or replace function has_unconsumed_posting_fee()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from payments
    where profile_id = auth.uid()
      and purpose = 'requirement_posting'
      and status = 'paid'
      and consumed_at is null
  );
end;
$$;

revoke all on function has_unconsumed_posting_fee() from public;
grant execute on function has_unconsumed_posting_fee() to authenticated;
