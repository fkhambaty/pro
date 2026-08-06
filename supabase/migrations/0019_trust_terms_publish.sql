-- 0019: publish RPC, terms acceptance, block requests, accept-then-pay milestones.
-- Razorpay-only posture: build money stays off-platform; Okavo never holds escrow.

-- ---------------------------------------------------------------------------
-- Terms acceptance on profiles
-- ---------------------------------------------------------------------------
alter table profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

comment on column profiles.terms_accepted_at is
  'When the user last accepted Okavo Terms (marketplace intermediary rules).';

create or replace function accept_platform_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if p_version is null or length(trim(p_version)) = 0 then
    raise exception 'Terms version required';
  end if;

  update profiles
     set terms_version = trim(p_version),
         terms_accepted_at = now()
   where id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke all on function accept_platform_terms(text) from public;
grant execute on function accept_platform_terms(text) to authenticated;

create or replace function has_accepted_current_terms(p_version text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from profiles
     where id = auth.uid()
       and terms_accepted_at is not null
       and terms_version = p_version
  );
$$;

revoke all on function has_accepted_current_terms(text) from public;
grant execute on function has_accepted_current_terms(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic publish (fee consumption stays on projects insert trigger)
-- ---------------------------------------------------------------------------
create or replace function publish_requirement(
  p_title text,
  p_category text,
  p_outcome text,
  p_budget_min_cents integer,
  p_budget_max_cents integer,
  p_monthly_run_cents integer,
  p_timeline_weeks integer,
  p_scope jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid := auth.uid();
  v_project_id uuid;
  v_item jsonb;
  v_pos integer := 0;
begin
  if v_buyer is null then
    raise exception 'Sign in required';
  end if;

  if not exists (
    select 1 from profiles
     where id = v_buyer and role = 'buyer'
  ) then
    raise exception 'Only buyers can publish requirements';
  end if;

  if not exists (
    select 1 from profiles
     where id = v_buyer
       and terms_accepted_at is not null
  ) then
    raise exception 'Accept the Okavo Terms before publishing';
  end if;

  if p_title is null or length(trim(p_title)) < 3 then
    raise exception 'Title too short';
  end if;
  if p_outcome is null or length(trim(p_outcome)) < 20 then
    raise exception 'Outcome too short';
  end if;
  if p_budget_min_cents is null or p_budget_min_cents <= 0
     or p_budget_max_cents is null or p_budget_max_cents <= 0
     or p_budget_max_cents < p_budget_min_cents then
    raise exception 'Invalid budget';
  end if;
  if p_timeline_weeks is null or p_timeline_weeks <= 0 then
    raise exception 'Invalid timeline';
  end if;

  insert into projects (
    buyer_id, title, category, outcome_statement,
    budget_min_cents, budget_max_cents, monthly_run_cents, timeline_weeks,
    stage, published_at
  ) values (
    v_buyer, trim(p_title), trim(p_category), trim(p_outcome),
    p_budget_min_cents, p_budget_max_cents,
    coalesce(p_monthly_run_cents, 0), p_timeline_weeks,
    'clarifying', now()
  )
  returning id into v_project_id;

  if p_scope is not null and jsonb_typeof(p_scope) = 'array' then
    for v_item in select * from jsonb_array_elements(p_scope)
    loop
      insert into scope_items (
        project_id, label, detail, included, acceptance_criteria, position
      ) values (
        v_project_id,
        coalesce(v_item->>'label', 'Scope item'),
        coalesce(v_item->>'detail', ''),
        coalesce((v_item->>'included')::boolean, true),
        nullif(v_item->>'acceptance_criteria', ''),
        v_pos
      );
      v_pos := v_pos + 1;
    end loop;
  end if;

  perform write_audit_event(
    'project.publish',
    'project',
    v_project_id,
    jsonb_build_object('title', trim(p_title), 'category', trim(p_category))
  );

  return v_project_id;
end;
$$;

revoke all on function publish_requirement(text, text, text, integer, integer, integer, integer, jsonb) from public;
grant execute on function publish_requirement(text, text, text, integer, integer, integer, integer, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Developer block requests (buyer reports ghosting / cheating)
-- ---------------------------------------------------------------------------
create table if not exists developer_block_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id),
  developer_id uuid not null references profiles(id),
  project_id uuid references projects(id),
  reason text not null,
  detail text,
  status text not null default 'open'
    check (status in ('open', 'approved', 'rejected', 'withdrawn')),
  admin_note text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint block_not_self check (buyer_id <> developer_id)
);

create index if not exists developer_block_requests_status_idx
  on developer_block_requests (status, created_at desc);
create index if not exists developer_block_requests_dev_idx
  on developer_block_requests (developer_id, status);

alter table developer_block_requests enable row level security;

drop policy if exists block_requests_buyer_read on developer_block_requests;
create policy block_requests_buyer_read on developer_block_requests
  for select to authenticated
  using (buyer_id = auth.uid() or is_admin());

drop policy if exists block_requests_buyer_insert on developer_block_requests;
create policy block_requests_buyer_insert on developer_block_requests
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and role = 'buyer')
  );

drop policy if exists block_requests_admin_update on developer_block_requests;
create policy block_requests_admin_update on developer_block_requests
  for update to authenticated
  using (is_admin())
  with check (is_admin());

-- Platform bans after admin approval
alter table developer_profiles
  add column if not exists platform_blocked_at timestamptz,
  add column if not exists platform_block_reason text;

create or replace function request_developer_block(
  p_developer_id uuid,
  p_reason text,
  p_detail text default null,
  p_project_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid := auth.uid();
  v_id uuid;
begin
  if v_buyer is null then
    raise exception 'Sign in required';
  end if;
  if not exists (select 1 from profiles where id = v_buyer and role = 'buyer') then
    raise exception 'Only buyers can request a block';
  end if;
  if not exists (select 1 from profiles where id = p_developer_id and role = 'developer') then
    raise exception 'Developer not found';
  end if;
  if p_reason is null or length(trim(p_reason)) < 8 then
    raise exception 'Explain why you are requesting a block';
  end if;

  -- Buyer must have a relationship: awarded bid or hired project with this developer
  if not exists (
    select 1
      from contracts c
     where c.buyer_id = v_buyer
       and c.developer_id = p_developer_id
  ) and not exists (
    select 1
      from bids b
      join projects p on p.id = b.project_id
     where p.buyer_id = v_buyer
       and b.developer_id = p_developer_id
       and b.status = 'awarded'
  ) then
    raise exception 'You can only block a developer you hired or awarded';
  end if;

  insert into developer_block_requests (
    buyer_id, developer_id, project_id, reason, detail
  ) values (
    v_buyer, p_developer_id, p_project_id, trim(p_reason), nullif(trim(p_detail), '')
  )
  returning id into v_id;

  perform write_audit_event(
    'block.request',
    'developer',
    p_developer_id,
    jsonb_build_object('request_id', v_id, 'reason', trim(p_reason))
  );

  return v_id;
end;
$$;

revoke all on function request_developer_block(uuid, text, text, uuid) from public;
grant execute on function request_developer_block(uuid, text, text, uuid) to authenticated;

create or replace function review_developer_block(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req developer_block_requests%rowtype;
begin
  if not is_admin() then
    raise exception 'Only Okavo can review block requests';
  end if;

  select * into v_req
    from developer_block_requests
   where id = p_request_id
   for update;

  if not found then
    raise exception 'Block request not found';
  end if;
  if v_req.status <> 'open' then
    raise exception 'Block request already reviewed';
  end if;

  if p_approve then
    update developer_block_requests
       set status = 'approved',
           admin_note = nullif(trim(p_admin_note), ''),
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = p_request_id;

    update developer_profiles
       set platform_blocked_at = now(),
           platform_block_reason = coalesce(nullif(trim(p_admin_note), ''), v_req.reason),
           bidding_unlocked_at = null
     where profile_id = v_req.developer_id;
  else
    update developer_block_requests
       set status = 'rejected',
           admin_note = nullif(trim(p_admin_note), ''),
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = p_request_id;
  end if;

  perform write_audit_event(
    case when p_approve then 'block.approve' else 'block.reject' end,
    'developer',
    v_req.developer_id,
    jsonb_build_object('request_id', p_request_id)
  );
end;
$$;

revoke all on function review_developer_block(uuid, boolean, text) from public;
grant execute on function review_developer_block(uuid, boolean, text) to authenticated;

-- Blocked developers cannot place bids
create or replace function enforce_bid_eligibility()
returns trigger
language plpgsql
as $$
declare
  v_identity verification_status;
  v_unlocked timestamptz;
  v_blocked timestamptz;
  v_stage project_stage;
begin
  select identity_status, bidding_unlocked_at, platform_blocked_at
    into v_identity, v_unlocked, v_blocked
    from developer_profiles
   where profile_id = new.developer_id;

  if v_blocked is not null then
    raise exception 'This developer account is blocked from bidding on Okavo';
  end if;

  if v_identity is distinct from 'approved' then
    raise exception 'Identity must be approved before bidding';
  end if;

  if v_unlocked is null then
    raise exception 'Bidding membership must be paid before bidding';
  end if;

  select stage into v_stage from projects where id = new.project_id;
  if v_stage is distinct from 'locked' then
    raise exception 'Bids are only accepted on locked requirements';
  end if;

  if not coalesce(new.accepts_scope, false) then
    raise exception 'Bid must accept the locked scope';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accept-then-pay: accept work first; attest payment releases funds record
-- ---------------------------------------------------------------------------
create or replace function accept_milestone(p_milestone_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid;
  v_status milestone_status;
begin
  select c.buyer_id, m.status
    into v_buyer, v_status
    from milestones m
    join contracts c on c.id = m.contract_id
   where m.id = p_milestone_id
   for update of m;

  if not found then
    raise exception 'Milestone not found';
  end if;
  if v_buyer is distinct from auth.uid() and not is_admin() then
    raise exception 'Only the buyer can accept a milestone';
  end if;
  if v_status is distinct from 'submitted' then
    raise exception 'Milestone must be submitted before acceptance';
  end if;

  -- Work approved; payment still owed outside Okavo until attest.
  update milestones
     set status = 'accepted',
         accepted_at = now()
   where id = p_milestone_id;

  perform write_audit_event(
    'milestone.accept',
    'milestone',
    p_milestone_id,
    '{}'::jsonb
  );
end;
$$;

revoke all on function accept_milestone(uuid) from public;
grant execute on function accept_milestone(uuid) to authenticated;

-- Attest payment for accepted work (or legacy pending→funded for transition)
create or replace function attest_external_milestone_payment(p_milestone_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract contracts%rowtype;
  v_milestone milestones%rowtype;
  v_project projects%rowtype;
begin
  select * into v_milestone from milestones where id = p_milestone_id for update;
  if not found then
    raise exception 'Milestone not found';
  end if;

  select * into v_contract from contracts where id = v_milestone.contract_id;
  select * into v_project from projects where id = v_contract.project_id;

  if v_contract.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can attest payment';
  end if;

  if v_project.stage not in ('hired', 'in_delivery', 'delivered') then
    raise exception 'Project is not in a payable stage';
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
    v_contract.buyer_id,
    'milestone_funding',
    'paid',
    v_milestone.amount_cents,
    'USD',
    'external',
    'external:' || v_milestone.id::text,
    v_contract.id,
    v_milestone.id,
    v_contract.project_id,
    now()
  );

  update milestones
     set status = 'released',
         funded_at = coalesce(funded_at, now())
   where id = p_milestone_id;

  perform notify_profile(
    v_contract.developer_id,
    'payment',
    'Milestone paid',
    'The buyer confirmed payment for "' || v_milestone.title || '" after accepting the work.',
    '/app/contract/' || v_contract.project_id
  );

  perform write_audit_event(
    'milestone.fund',
    'milestone',
    p_milestone_id,
    jsonb_build_object('mode', 'accept_then_pay')
  );
end;
$$;

revoke all on function attest_external_milestone_payment(uuid) from public;
grant execute on function attest_external_milestone_payment(uuid) to authenticated;

-- Countersign no longer requires first milestone funded (work can start; pay after accept)
create or replace function countersign_contract(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract contracts%rowtype;
begin
  select * into v_contract
    from contracts
   where project_id = p_project_id
   for update;

  if not found then
    raise exception 'Contract not found';
  end if;

  if v_contract.developer_id is distinct from auth.uid() then
    raise exception 'Only the awarded developer can countersign';
  end if;

  if v_contract.developer_signed_at is not null then
    return;
  end if;

  if not exists (
    select 1 from profiles
     where id = auth.uid()
       and terms_accepted_at is not null
  ) then
    raise exception 'Accept the Okavo Terms before countersigning';
  end if;

  update contracts
     set developer_signed_at = now(),
         status = 'active'
   where id = v_contract.id;

  update projects
     set stage = 'in_delivery'
   where id = p_project_id
     and stage = 'hired';

  -- Open first milestone for work without requiring prepayment.
  update milestones
     set status = 'in_progress'
   where contract_id = v_contract.id
     and position = 0
     and status = 'pending';

  perform write_audit_event(
    'contract.countersign',
    'project',
    p_project_id,
    '{}'::jsonb
  );
end;
$$;

revoke all on function countersign_contract(uuid) from public;
grant execute on function countersign_contract(uuid) to authenticated;

-- After a milestone is released, open the next pending one for work
create or replace function open_next_milestone_after_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'released' and old.status is distinct from 'released' then
    update milestones
       set status = 'in_progress'
     where contract_id = new.contract_id
       and status = 'pending'
       and position = (
         select min(position)
           from milestones
          where contract_id = new.contract_id
            and status = 'pending'
       );
  end if;
  return new;
end;
$$;

drop trigger if exists milestones_open_next on milestones;
create trigger milestones_open_next
  after update of status on milestones
  for each row execute function open_next_milestone_after_release();
