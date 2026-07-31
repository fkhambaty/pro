-- Real payments.
--
-- Until now the browser inserted its own `payments` rows with status 'paid',
-- so any signed-in user could grant themselves a free posting fee, a free
-- bidding membership, or a funded milestone. Money must only ever be recorded
-- by the Stripe webhook, which runs with the service role.

-- ---------------------------------------------------------------------------
-- Idempotency for webhook replays
-- ---------------------------------------------------------------------------

create unique index if not exists payments_provider_reference_key
  on payments (provider_reference)
  where provider_reference is not null;

-- ---------------------------------------------------------------------------
-- Clients may read their own payments. They may not write them.
-- ---------------------------------------------------------------------------

drop policy if exists payments_owner on payments;
drop policy if exists payments_read on payments;
drop policy if exists payments_insert on payments;
drop policy if exists payments_update on payments;

create policy payments_read on payments
  for select using (profile_id = auth.uid() or is_admin());

-- No insert/update/delete policy: with RLS enabled that denies every write
-- from anon and authenticated roles. The service role bypasses RLS, so only
-- the checkout and webhook functions can create or settle a payment.

-- ---------------------------------------------------------------------------
-- A milestone may only become 'funded' once escrow has actually been paid
-- ---------------------------------------------------------------------------

create or replace function enforce_milestone_funding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'funded' and coalesce(old.status, 'pending') is distinct from 'funded' then
    if not exists (
      select 1
      from payments
      where milestone_id = new.id
        and purpose = 'milestone_funding'
        and status = 'paid'
    ) then
      raise exception 'This milestone has not been funded into escrow yet';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists milestones_funding_guard on milestones;

create trigger milestones_funding_guard before update on milestones
  for each row execute function enforce_milestone_funding();
