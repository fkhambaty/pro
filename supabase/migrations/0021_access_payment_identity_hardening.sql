-- Access, external-payment proof, and identity decision hardening.

-- Deliverable files are private to the contract parties and admins.
drop policy if exists deliverables_read on storage.objects;
create policy deliverables_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'deliverables'
    and (
      is_admin()
      or exists (
        select 1
          from deliverables d
          join milestones m on m.id = d.milestone_id
          join contracts c on c.id = m.contract_id
         where d.storage_path = storage.objects.name
           and (c.buyer_id = auth.uid() or c.developer_id = auth.uid())
      )
    )
  );

-- Optional evidence for money paid directly between contract parties.
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

alter table payments
  add column if not exists proof_storage_path text,
  add column if not exists payer_reference text;

drop policy if exists payment_proofs_owner_write on storage.objects;
create policy payment_proofs_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists payment_proofs_owner_delete on storage.objects;
create policy payment_proofs_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists payment_proofs_parties_read on storage.objects;
create policy payment_proofs_parties_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      is_admin()
      or exists (
        select 1
          from payments p
          join contracts c on c.id = p.contract_id
         where p.proof_storage_path = storage.objects.name
           and (c.buyer_id = auth.uid() or c.developer_id = auth.uid())
      )
    )
  );

create unique index if not exists payments_external_milestone_once
  on payments (milestone_id)
  where provider = 'external'
    and purpose = 'milestone_funding'
    and status = 'paid';

-- Payment metadata for contract work is visible to both parties; platform fees
-- remain visible only to their owner and admins.
drop policy if exists payments_read on payments;
create policy payments_read on payments
  for select using (
    profile_id = auth.uid()
    or is_admin()
    or (
      contract_id is not null
      and exists (
        select 1
          from contracts c
         where c.id = payments.contract_id
           and (c.buyer_id = auth.uid() or c.developer_id = auth.uid())
      )
    )
  );

drop function if exists attest_external_milestone_payment(uuid);

create function attest_external_milestone_payment(
  p_milestone_id uuid,
  p_payer_reference text default null,
  p_proof_storage_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_row milestones%rowtype;
  contract_row contracts%rowtype;
  payment_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into milestone_row
    from milestones
   where id = p_milestone_id
   for update;
  if not found then raise exception 'Milestone not found'; end if;

  select * into contract_row
    from contracts
   where id = milestone_row.contract_id;
  if contract_row.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can confirm an outside payment';
  end if;

  select id into payment_id
    from payments
   where milestone_id = milestone_row.id
     and provider = 'external'
     and purpose = 'milestone_funding'
     and status = 'paid';
  if payment_id is not null then return payment_id; end if;

  if milestone_row.status is distinct from 'accepted' then
    raise exception 'Accept the submitted work before confirming payment';
  end if;

  insert into payments (
    profile_id, purpose, status, amount_cents, currency, provider,
    provider_reference, contract_id, milestone_id, project_id, paid_at,
    payer_reference, proof_storage_path
  ) values (
    contract_row.buyer_id, 'milestone_funding', 'paid',
    milestone_row.amount_cents, 'USD', 'external',
    'external:' || milestone_row.id::text, contract_row.id, milestone_row.id,
    contract_row.project_id, now(),
    nullif(left(trim(p_payer_reference), 200), ''),
    nullif(left(trim(p_proof_storage_path), 500), '')
  )
  on conflict (milestone_id)
    where provider = 'external'
      and purpose = 'milestone_funding'
      and status = 'paid'
  do nothing
  returning id into payment_id;

  if payment_id is null then
    select id into payment_id
      from payments
     where milestone_id = milestone_row.id
       and provider = 'external'
       and purpose = 'milestone_funding'
       and status = 'paid';
  end if;

  update milestones
     set status = 'released',
         released_at = coalesce(released_at, now())
   where id = milestone_row.id
     and status = 'accepted';

  return payment_id;
end;
$$;

revoke all on function attest_external_milestone_payment(uuid, text, text) from public;
grant execute on function attest_external_milestone_payment(uuid, text, text) to authenticated;

-- A decision always starts a 90-day document-retention clock.
create or replace function set_identity_retention_deadline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('approved', 'rejected')
     and (old.status is distinct from new.status or new.reviewed_at is distinct from old.reviewed_at) then
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.expires_at := (new.reviewed_at + interval '90 days')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists identity_retention_deadline on identity_verifications;
create trigger identity_retention_deadline
  before update on identity_verifications
  for each row execute function set_identity_retention_deadline();
