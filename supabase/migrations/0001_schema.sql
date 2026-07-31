-- Okavo — commission software anywhere, on a locked agreement
-- Core schema: identities, projects, contracts, bidding, delivery, money, trust.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('buyer', 'developer', 'admin');
create type buyer_scale as enum ('local_business', 'smb', 'startup', 'enterprise');
create type developer_tier as enum ('applicant', 'associate', 'verified', 'principal');
create type verification_status as enum ('not_started', 'submitted', 'in_review', 'approved', 'rejected');
create type project_stage as enum ('drafting', 'locked', 'hired', 'in_delivery', 'delivered', 'closed', 'cancelled');
create type contract_status as enum ('draft', 'locked', 'active', 'completed', 'disputed', 'terminated');
create type bid_status as enum ('submitted', 'shortlisted', 'declined', 'withdrawn', 'awarded');
create type milestone_status as enum ('pending', 'funded', 'in_progress', 'submitted', 'accepted', 'rejected', 'released');
create type change_order_status as enum ('proposed', 'priced', 'accepted', 'declined', 'withdrawn');
create type dispute_status as enum ('open', 'evidence', 'resolved_buyer', 'resolved_developer', 'split', 'withdrawn');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type payment_purpose as enum ('bidding_membership', 'requirement_posting', 'milestone_funding', 'change_order', 'payout', 'platform_fee');
create type notification_kind as enum ('bid', 'contract', 'milestone', 'message', 'change_order', 'dispute', 'payment', 'verification');

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'buyer',
  full_name text not null,
  email text not null unique,
  avatar_url text,
  country_code text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table buyer_profiles (
  profile_id uuid primary key references profiles (id) on delete cascade,
  organization_name text not null,
  scale buyer_scale not null default 'local_business',
  website text,
  billing_email text,
  vat_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table developer_profiles (
  profile_id uuid primary key references profiles (id) on delete cascade,
  headline text not null default '',
  bio text,
  hourly_rate_usd numeric(10, 2),
  tier developer_tier not null default 'applicant',
  identity_status verification_status not null default 'not_started',
  interview_status verification_status not null default 'not_started',
  -- Set only when the one-time bidding membership is paid. Enforced by trigger.
  bidding_unlocked_at timestamptz,
  contracts_delivered integer not null default 0,
  first_pass_acceptance numeric(5, 2),
  disputes_lost integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null
);

create table developer_skills (
  developer_id uuid not null references developer_profiles (profile_id) on delete cascade,
  skill_id uuid not null references skills (id) on delete cascade,
  primary key (developer_id, skill_id)
);

-- ---------------------------------------------------------------------------
-- Trust: identity documents and the recorded build interview
-- ---------------------------------------------------------------------------

create table identity_verifications (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references developer_profiles (profile_id) on delete cascade,
  status verification_status not null default 'submitted',
  document_type text not null,
  document_country text not null,
  document_storage_path text not null,
  selfie_storage_path text,
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  rejection_reason text,
  expires_at date,
  created_at timestamptz not null default now()
);

create table interview_assessments (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references developer_profiles (profile_id) on delete cascade,
  status verification_status not null default 'submitted',
  brief_slug text not null,
  repo_url text,
  live_url text,
  recording_storage_path text,
  duration_minutes integer,
  score_security integer check (score_security between 0 and 100),
  score_efficiency integer check (score_efficiency between 0 and 100),
  score_maintainability integer check (score_maintainability between 0 and 100),
  score_recovery integer check (score_recovery between 0 and 100),
  score_overall integer check (score_overall between 0 and 100),
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------

create table payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  purpose payment_purpose not null,
  status payment_status not null default 'pending',
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  provider text not null default 'stripe',
  provider_reference text,
  project_id uuid,
  contract_id uuid,
  milestone_id uuid,
  paid_at timestamptz,
  -- Set when a one-off fee is spent, so a single payment cannot be reused.
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_profile_idx on payments (profile_id, purpose, status);
create index payments_unconsumed_idx on payments (profile_id, purpose)
  where consumed_at is null;

-- ---------------------------------------------------------------------------
-- Projects and the requirement lock
-- ---------------------------------------------------------------------------

create table projects (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references buyer_profiles (profile_id) on delete cascade,
  title text not null,
  category text not null,
  outcome_statement text not null,
  stage project_stage not null default 'drafting',
  budget_min_cents integer not null check (budget_min_cents >= 0),
  budget_max_cents integer not null check (budget_max_cents >= 0),
  monthly_run_cents integer not null default 0 check (monthly_run_cents >= 0),
  timeline_weeks integer not null default 6 check (timeline_weeks > 0),
  visibility text not null default 'public',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_range_valid check (budget_max_cents >= budget_min_cents)
);

create index projects_stage_idx on projects (stage, published_at desc);

create table project_skills (
  project_id uuid not null references projects (id) on delete cascade,
  skill_id uuid not null references skills (id) on delete cascade,
  primary key (project_id, skill_id)
);

create table scope_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  label text not null,
  detail text not null default '',
  included boolean not null default true,
  acceptance_criteria text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index scope_items_project_idx on scope_items (project_id, position);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects (id) on delete cascade,
  buyer_id uuid not null references buyer_profiles (profile_id),
  developer_id uuid references developer_profiles (profile_id),
  lock_reference text not null unique,
  status contract_status not null default 'draft',
  current_version integer not null default 1,
  agreed_amount_cents integer,
  agreed_monthly_cents integer,
  agreed_weeks integer,
  warranty_days integer not null default 30,
  locked_at timestamptz,
  buyer_signed_at timestamptz,
  developer_signed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Immutable snapshot of the scope at each lock or accepted change order.
create table contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  reason text not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (contract_id, version)
);

-- ---------------------------------------------------------------------------
-- Bidding
-- ---------------------------------------------------------------------------

create table bids (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  developer_id uuid not null references developer_profiles (profile_id) on delete cascade,
  status bid_status not null default 'submitted',
  amount_cents integer not null check (amount_cents > 0),
  monthly_run_cents integer not null default 0,
  delivery_weeks integer not null check (delivery_weeks > 0),
  message text not null default '',
  accepts_locked_scope boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, developer_id)
);

create index bids_project_idx on bids (project_id, status);

-- ---------------------------------------------------------------------------
-- Delivery
-- ---------------------------------------------------------------------------

create table milestones (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  title text not null,
  description text not null default '',
  amount_cents integer not null check (amount_cents > 0),
  position integer not null default 0,
  status milestone_status not null default 'pending',
  due_on date,
  funded_at timestamptz,
  submitted_at timestamptz,
  accepted_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create index milestones_contract_idx on milestones (contract_id, position);

create table deliverables (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references milestones (id) on delete cascade,
  developer_id uuid not null references developer_profiles (profile_id),
  summary text not null,
  preview_url text,
  repository_url text,
  storage_path text,
  submitted_at timestamptz not null default now(),
  buyer_feedback text,
  accepted boolean
);

create table change_orders (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  raised_by uuid not null references profiles (id),
  title text not null,
  description text not null,
  status change_order_status not null default 'proposed',
  amount_cents integer,
  added_weeks integer default 0,
  scope_delta jsonb,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index change_orders_contract_idx on change_orders (contract_id, status);

-- ---------------------------------------------------------------------------
-- Communication
-- ---------------------------------------------------------------------------

create table message_threads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects (id) on delete cascade,
  contract_id uuid references contracts (id) on delete cascade,
  buyer_id uuid not null references profiles (id),
  developer_id uuid not null references profiles (id),
  subject text not null default '',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads (id) on delete cascade,
  sender_id uuid not null references profiles (id),
  body text not null,
  attachment_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_thread_idx on messages (thread_id, created_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  kind notification_kind not null,
  title text not null,
  body text not null default '',
  link_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on notifications (profile_id, read_at, created_at desc);

-- ---------------------------------------------------------------------------
-- Outcomes
-- ---------------------------------------------------------------------------

create table disputes (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  raised_by uuid not null references profiles (id),
  status dispute_status not null default 'open',
  reason text not null,
  scope_item_ids uuid[],
  resolution_note text,
  resolved_by uuid references profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  author_id uuid not null references profiles (id),
  subject_id uuid not null references profiles (id),
  rating integer not null check (rating between 1 and 5),
  matched_expectation boolean not null default true,
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (contract_id, author_id)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index audit_entity_idx on audit_events (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers and triggers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger buyer_profiles_updated_at before update on buyer_profiles
  for each row execute function set_updated_at();
create trigger developer_profiles_updated_at before update on developer_profiles
  for each row execute function set_updated_at();
create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger contracts_updated_at before update on contracts
  for each row execute function set_updated_at();
create trigger bids_updated_at before update on bids
  for each row execute function set_updated_at();

-- A developer may only bid when identity is approved and the one-time
-- bidding membership has been paid. This is the paywall, enforced in the
-- database rather than only in the interface.
create or replace function enforce_bid_eligibility()
returns trigger
language plpgsql
as $$
declare
  dev developer_profiles%rowtype;
  project_stage_value project_stage;
begin
  select * into dev from developer_profiles where profile_id = new.developer_id;

  if dev.identity_status <> 'approved' then
    raise exception 'Identity verification must be approved before bidding';
  end if;

  if dev.bidding_unlocked_at is null then
    raise exception 'Bidding membership payment required before bidding';
  end if;

  select stage into project_stage_value from projects where id = new.project_id;

  if project_stage_value <> 'locked' then
    raise exception 'Bids are only accepted while the requirement is locked';
  end if;

  if new.accepts_locked_scope is not true then
    raise exception 'Bid must accept the locked scope as the definition of done';
  end if;

  return new;
end;
$$;

create trigger bids_eligibility before insert on bids
  for each row execute function enforce_bid_eligibility();

-- A buyer must have paid a posting fee before a requirement can be created.
-- The fee is consumed by the insert, so one payment posts exactly one
-- requirement. This is the buyer-side equivalent of the bidding membership.
create or replace function enforce_posting_fee()
returns trigger
language plpgsql
as $$
declare
  fee_id uuid;
begin
  select id into fee_id
  from payments
  where profile_id = new.buyer_id
    and purpose = 'requirement_posting'
    and status = 'paid'
    and consumed_at is null
  order by created_at
  limit 1;

  if fee_id is null then
    raise exception 'A posting fee must be paid before creating a requirement';
  end if;

  update payments
    set consumed_at = now(), project_id = new.id
    where id = fee_id;

  return new;
end;
$$;

create trigger projects_posting_fee before insert on projects
  for each row execute function enforce_posting_fee();

-- Paying the membership unlocks bidding.
create or replace function apply_membership_payment()
returns trigger
language plpgsql
as $$
begin
  if new.purpose = 'bidding_membership' and new.status = 'paid' then
    update developer_profiles
      set bidding_unlocked_at = coalesce(bidding_unlocked_at, now())
      where profile_id = new.profile_id;
  end if;
  return new;
end;
$$;

create trigger payments_unlock_bidding after insert or update on payments
  for each row execute function apply_membership_payment();

-- Locking a requirement freezes an immutable snapshot of its scope.
create or replace function snapshot_contract_scope()
returns trigger
language plpgsql
as $$
declare
  snapshot_json jsonb;
begin
  if new.status = 'locked' and (old.status is distinct from new.status) then
    select jsonb_build_object(
      'project', to_jsonb(p),
      'scope', coalesce(jsonb_agg(to_jsonb(s) order by s.position), '[]'::jsonb)
    )
    into snapshot_json
    from projects p
    left join scope_items s on s.project_id = p.id
    where p.id = new.project_id
    group by p.id;

    insert into contract_versions (contract_id, version, snapshot, reason)
    values (new.id, new.current_version, snapshot_json, 'Requirement locked');
  end if;
  return new;
end;
$$;

create trigger contracts_snapshot after update on contracts
  for each row execute function snapshot_contract_scope();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table buyer_profiles enable row level security;
alter table developer_profiles enable row level security;
alter table skills enable row level security;
alter table developer_skills enable row level security;
alter table project_skills enable row level security;
alter table identity_verifications enable row level security;
alter table interview_assessments enable row level security;
alter table payments enable row level security;
alter table projects enable row level security;
alter table scope_items enable row level security;
alter table contracts enable row level security;
alter table contract_versions enable row level security;
alter table bids enable row level security;
alter table milestones enable row level security;
alter table deliverables enable row level security;
alter table change_orders enable row level security;
alter table message_threads enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table disputes enable row level security;
alter table reviews enable row level security;
alter table audit_events enable row level security;

create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_admin());
create policy profiles_self_write on profiles
  for update using (id = auth.uid());
create policy profiles_insert on profiles
  for insert with check (id = auth.uid());

create policy buyer_self on buyer_profiles
  for all using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid());

-- Developer profiles are publicly readable so buyers can evaluate talent.
create policy developer_public_read on developer_profiles
  for select using (true);
create policy developer_self_write on developer_profiles
  for update using (profile_id = auth.uid() or is_admin());
create policy developer_self_insert on developer_profiles
  for insert with check (profile_id = auth.uid());

create policy verification_owner on identity_verifications
  for all using (developer_id = auth.uid() or is_admin())
  with check (developer_id = auth.uid());

create policy interview_owner on interview_assessments
  for all using (developer_id = auth.uid() or is_admin())
  with check (developer_id = auth.uid());

create policy payments_owner on payments
  for all using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid());

-- Locked projects are visible to every signed-in user; drafts stay private.
create policy projects_read on projects
  for select using (
    stage <> 'drafting'
    or buyer_id = auth.uid()
    or is_admin()
  );
create policy projects_owner_write on projects
  for all using (buyer_id = auth.uid() or is_admin())
  with check (buyer_id = auth.uid());

create policy scope_read on scope_items
  for select using (
    exists (
      select 1 from projects p
      where p.id = project_id
        and (p.stage <> 'drafting' or p.buyer_id = auth.uid() or is_admin())
    )
  );
create policy scope_owner_write on scope_items
  for all using (
    exists (select 1 from projects p where p.id = project_id and p.buyer_id = auth.uid())
    or is_admin()
  )
  with check (
    exists (select 1 from projects p where p.id = project_id and p.buyer_id = auth.uid())
  );

create policy contracts_parties on contracts
  for select using (
    buyer_id = auth.uid() or developer_id = auth.uid() or is_admin()
  );
create policy contracts_buyer_write on contracts
  for all using (buyer_id = auth.uid() or is_admin())
  with check (buyer_id = auth.uid());

create policy contract_versions_parties on contract_versions
  for select using (
    exists (
      select 1 from contracts c
      where c.id = contract_id
        and (c.buyer_id = auth.uid() or c.developer_id = auth.uid() or is_admin())
    )
  );

-- A developer sees only their own bid; the buyer sees every bid on their project.
create policy bids_visibility on bids
  for select using (
    developer_id = auth.uid()
    or exists (select 1 from projects p where p.id = project_id and p.buyer_id = auth.uid())
    or is_admin()
  );
create policy bids_developer_write on bids
  for insert with check (developer_id = auth.uid());
create policy bids_developer_update on bids
  for update using (
    developer_id = auth.uid()
    or exists (select 1 from projects p where p.id = project_id and p.buyer_id = auth.uid())
  );

create policy milestones_parties on milestones
  for all using (
    exists (
      select 1 from contracts c
      where c.id = contract_id
        and (c.buyer_id = auth.uid() or c.developer_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from contracts c
      where c.id = contract_id
        and (c.buyer_id = auth.uid() or c.developer_id = auth.uid())
    )
  );

create policy deliverables_parties on deliverables
  for all using (
    exists (
      select 1 from milestones m
      join contracts c on c.id = m.contract_id
      where m.id = milestone_id
        and (c.buyer_id = auth.uid() or c.developer_id = auth.uid() or is_admin())
    )
  )
  with check (developer_id = auth.uid());

-- Either party may read a change order, but only the raiser may create one.
-- Updates (pricing, accepting, declining) are done by the counterparty, so the
-- update policy checks membership of the contract rather than authorship.
create policy change_orders_read on change_orders
  for select using (
    exists (
      select 1 from contracts c
      where c.id = contract_id
        and (c.buyer_id = auth.uid() or c.developer_id = auth.uid() or is_admin())
    )
  );

create policy change_orders_insert on change_orders
  for insert with check (
    raised_by = auth.uid()
    and exists (
      select 1 from contracts c
      where c.id = contract_id
        and (c.buyer_id = auth.uid() or c.developer_id = auth.uid())
    )
  );

create policy change_orders_update on change_orders
  for update using (
    exists (
      select 1 from contracts c
      where c.id = contract_id
        and (c.buyer_id = auth.uid() or c.developer_id = auth.uid() or is_admin())
    )
  );

create policy threads_parties on message_threads
  for all using (buyer_id = auth.uid() or developer_id = auth.uid() or is_admin())
  with check (buyer_id = auth.uid() or developer_id = auth.uid());

create policy messages_read on messages
  for select using (
    exists (
      select 1 from message_threads t
      where t.id = thread_id
        and (t.buyer_id = auth.uid() or t.developer_id = auth.uid() or is_admin())
    )
  );

create policy messages_insert on messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from message_threads t
      where t.id = thread_id
        and (t.buyer_id = auth.uid() or t.developer_id = auth.uid())
    )
  );

-- The recipient marks a message read, so update is not limited to the sender.
create policy messages_update on messages
  for update using (
    exists (
      select 1 from message_threads t
      where t.id = thread_id
        and (t.buyer_id = auth.uid() or t.developer_id = auth.uid())
    )
  );

create policy notifications_owner on notifications
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy disputes_read on disputes
  for select using (
    exists (
      select 1 from contracts c
      where c.id = contract_id
        and (c.buyer_id = auth.uid() or c.developer_id = auth.uid() or is_admin())
    )
  );

create policy disputes_insert on disputes
  for insert with check (
    raised_by = auth.uid()
    and exists (
      select 1 from contracts c
      where c.id = contract_id
        and (c.buyer_id = auth.uid() or c.developer_id = auth.uid())
    )
  );

-- Resolution is recorded by the counterparty or an admin.
create policy disputes_update on disputes
  for update using (
    exists (
      select 1 from contracts c
      where c.id = contract_id
        and (c.buyer_id = auth.uid() or c.developer_id = auth.uid() or is_admin())
    )
  );

create policy reviews_read on reviews
  for select using (true);
create policy reviews_author on reviews
  for insert with check (author_id = auth.uid());

create policy audit_admin_read on audit_events
  for select using (is_admin());

-- Skills are public reference data: readable by everyone, writable by nobody.
create policy skills_read on skills
  for select using (true);

create policy developer_skills_read on developer_skills
  for select using (true);

create policy developer_skills_own on developer_skills
  for all using (developer_id = auth.uid())
  with check (developer_id = auth.uid());

create policy project_skills_read on project_skills
  for select using (
    exists (
      select 1 from projects p
      where p.id = project_id
        and (p.stage <> 'drafting' or p.buyer_id = auth.uid() or is_admin())
    )
  );

create policy project_skills_own on project_skills
  for all using (
    exists (select 1 from projects p where p.id = project_id and p.buyer_id = auth.uid())
    or is_admin()
  )
  with check (
    exists (select 1 from projects p where p.id = project_id and p.buyer_id = auth.uid())
  );
