-- Off-platform milestone payment attestation.
--
-- Okavo does not yet hold build payments in escrow. Buyers pay developers
-- directly against the locked milestone schedule, then confirm here so the
-- existing funding guard (enforce_milestone_funding) can allow status=funded
-- and the developer can submit work against the signed scope.
--
-- This is not escrow. provider='external' means Okavo never held the money.

create or replace function attest_external_milestone_payment(p_milestone_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_row milestones%rowtype;
  contract_row contracts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into milestone_row
  from milestones
  where id = p_milestone_id
  for update;

  if not found then
    raise exception 'Milestone not found';
  end if;

  if milestone_row.status is distinct from 'pending' then
    raise exception 'Milestone is not awaiting payment confirmation';
  end if;

  select * into contract_row
  from contracts
  where id = milestone_row.contract_id;

  if not found then
    raise exception 'Contract not found';
  end if;

  if contract_row.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can confirm an outside payment';
  end if;

  if exists (
    select 1
    from payments
    where milestone_id = milestone_row.id
      and purpose = 'milestone_funding'
      and status = 'paid'
  ) then
    raise exception 'This milestone is already marked paid';
  end if;

  insert into payments (
    profile_id,
    purpose,
    status,
    amount_cents,
    currency,
    provider,
    provider_reference,
    contract_id,
    milestone_id,
    project_id,
    paid_at
  ) values (
    contract_row.buyer_id,
    'milestone_funding',
    'paid',
    milestone_row.amount_cents,
    'USD',
    'external',
    'external:' || milestone_row.id::text,
    contract_row.id,
    milestone_row.id,
    contract_row.project_id,
    now()
  );

  update milestones
  set status = 'funded',
      funded_at = now()
  where id = milestone_row.id;
end;
$$;

revoke all on function attest_external_milestone_payment(uuid) from public;
grant execute on function attest_external_milestone_payment(uuid) to authenticated;

comment on function attest_external_milestone_payment(uuid) is
  'Buyer confirms they paid the developer outside Okavo for a pending milestone. Creates a paid external payment row and sets the milestone to funded. Not escrow.';
