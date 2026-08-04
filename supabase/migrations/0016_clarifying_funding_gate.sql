-- Gemini-driven product seals: clarifying stage, Q&A, funding-before-countersign.

-- ---------------------------------------------------------------------------
-- Stage: clarifying = published for Q&A, not yet frozen for bids
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'project_stage' and e.enumlabel = 'clarifying'
  ) then
    alter type project_stage add value 'clarifying' after 'drafting';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Line-item clarification requests (pre-lock Q&A)
-- ---------------------------------------------------------------------------

create table if not exists clarification_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  developer_id uuid not null references profiles (id) on delete cascade,
  scope_item_id uuid references scope_items (id) on delete set null,
  question text not null,
  answer text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  answered_by uuid references profiles (id)
);

create index if not exists clarification_project_idx
  on clarification_requests (project_id, created_at desc);

alter table clarification_requests enable row level security;

drop policy if exists clarification_read on clarification_requests;
create policy clarification_read on clarification_requests
  for select using (
    is_admin()
    or developer_id = auth.uid()
    or exists (
      select 1 from projects p
      where p.id = project_id and p.buyer_id = auth.uid()
    )
  );

drop policy if exists clarification_dev_insert on clarification_requests;
create policy clarification_dev_insert on clarification_requests
  for insert with check (
    developer_id = auth.uid()
    and exists (
      select 1 from projects p
      where p.id = project_id
        and p.stage = 'clarifying'
        and exists (
          select 1 from profiles pr
          where pr.id = auth.uid() and pr.role = 'developer'
        )
    )
  );

drop policy if exists clarification_buyer_answer on clarification_requests;
create policy clarification_buyer_answer on clarification_requests
  for update using (
    exists (
      select 1 from projects p
      where p.id = project_id and p.buyer_id = auth.uid()
    )
    or is_admin()
  );

-- Developers may see clarifying + locked+ projects
drop policy if exists projects_read on projects;
create policy projects_read on projects
  for select using (
    is_admin()
    or buyer_id = auth.uid()
    or (
      stage in ('clarifying', 'locked', 'hired', 'in_delivery', 'delivered', 'closed')
      and exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.role = 'developer'
      )
    )
    or exists (
      select 1 from contracts c
      where c.project_id = projects.id
        and c.developer_id = auth.uid()
    )
  );

drop policy if exists scope_read on scope_items;
create policy scope_read on scope_items
  for select using (
    exists (
      select 1 from projects p
      where p.id = scope_items.project_id
        and (
          is_admin()
          or p.buyer_id = auth.uid()
          or (
            p.stage in ('clarifying', 'locked', 'hired', 'in_delivery', 'delivered', 'closed')
            and exists (
              select 1 from profiles pr
              where pr.id = auth.uid() and pr.role = 'developer'
            )
          )
          or exists (
            select 1 from contracts c
            where c.project_id = p.id and c.developer_id = auth.uid()
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Funding gate: first milestone must be funded before countersign
-- Attestation allowed after hire (before countersign)
-- ---------------------------------------------------------------------------

create or replace function attest_external_milestone_payment(p_milestone_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_row milestones%rowtype;
  contract_row contracts%rowtype;
  project_stage_value project_stage;
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

  select stage into project_stage_value
  from projects
  where id = contract_row.project_id;

  -- Funding gate: after hire, before or after countersign.
  if project_stage_value not in ('hired', 'in_delivery', 'delivered') then
    raise exception 'Hire a developer before funding a milestone';
  end if;

  if contract_row.developer_id is null then
    raise exception 'No developer awarded on this contract';
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

  perform notify_profile(
    contract_row.developer_id,
    'payment',
    'Milestone funded',
    'The buyer confirmed funding for "' || milestone_row.title || '". You can countersign if you have not already.',
    '/app/contract/' || contract_row.project_id
  );
end;
$$;

create or replace function countersign_contract(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_row contracts%rowtype;
  first_milestone milestones%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into contract_row
  from contracts
  where project_id = p_project_id
  for update;

  if not found then
    raise exception 'Contract not found';
  end if;

  if contract_row.developer_id is distinct from auth.uid() then
    raise exception 'Only the awarded developer can countersign';
  end if;

  if contract_row.developer_signed_at is not null then
    return;
  end if;

  if contract_row.buyer_signed_at is null then
    raise exception 'Buyer has not locked this requirement yet';
  end if;

  select * into first_milestone
  from milestones
  where contract_id = contract_row.id
  order by position asc
  limit 1;

  if not found then
    raise exception 'Milestones are not ready yet';
  end if;

  if first_milestone.status not in ('funded', 'in_progress', 'submitted', 'accepted', 'released') then
    raise exception 'Buyer must fund the first milestone before you countersign';
  end if;

  update contracts
     set developer_signed_at = now(),
         status = 'active',
         updated_at = now()
   where id = contract_row.id;

  update projects
     set stage = 'in_delivery',
         updated_at = now()
   where id = p_project_id;

  perform notify_profile(
    contract_row.buyer_id,
    'contract',
    'Developer countersigned the lock',
    'Work can now proceed against the signed scope.',
    '/app/contract/' || p_project_id
  );
end;
$$;

-- Answer a clarification (buyer)
create or replace function answer_clarification(
  p_request_id uuid,
  p_answer text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req clarification_requests%rowtype;
  project_row projects%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_answer), '') is null then
    raise exception 'Answer cannot be empty';
  end if;

  select * into req from clarification_requests where id = p_request_id for update;
  if not found then raise exception 'Clarification not found'; end if;

  select * into project_row from projects where id = req.project_id;
  if project_row.buyer_id is distinct from auth.uid() and not is_admin() then
    raise exception 'Only the buyer can answer';
  end if;

  update clarification_requests
     set answer = trim(p_answer),
         answered_at = now(),
         answered_by = auth.uid()
   where id = p_request_id;

  perform notify_profile(
    req.developer_id,
    'contract',
    'Buyer answered your clarification',
    left(trim(p_answer), 160),
    '/app/project/' || req.project_id
  );
end;
$$;

revoke all on function answer_clarification(uuid, text) from public;
grant execute on function answer_clarification(uuid, text) to authenticated;
