-- 0020: Timed build exam as bid gate + hire success fee (10%) plumbing.
-- Better than a live call per applicant: curated brief bank, async start,
-- auto-score assist, admin Q&A, 48h auto-approve if admin is silent.

-- ---------------------------------------------------------------------------
-- Exam briefs (curated bank — fairer than inventing a new brief each time)
-- ---------------------------------------------------------------------------
create table if not exists exam_briefs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  acceptance text not null,
  stack_hint text not null default 'Any web stack',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into exam_briefs (slug, title, summary, acceptance, stack_hint)
values
  (
    'mini-booking',
    'Mini booking page',
    'Build a single-page booking flow: list 3 services, pick a slot, submit a name + email, show a confirmation screen. Seed data is fine; no real payments.',
    'Live URL shows services and slots; submitting creates a confirmation the user can see without refreshing. Repo has a README with run steps.',
    'Next.js / Vite + any backend or localStorage'
  ),
  (
    'mini-store',
    'Mini catalog checkout',
    'Build a tiny store: 4 products, add to cart, checkout form (name + address), order summary page. No real payment gateway.',
    'Cart persists for the session; checkout shows line items and total; GitHub README explains how to run locally.',
    'Any web stack'
  ),
  (
    'issue-tracker',
    'Personal issue board',
    'Build a Kanban-style board with three columns (Todo / Doing / Done). Create, move, and delete cards. Persist to a DB or local file.',
    'Cards move between columns and survive a refresh; live URL works without a VPN; repo is public or shared with Okavo.',
    'Any web stack'
  ),
  (
    'auth-notes',
    'Signed-in notes',
    'Simple notes app: sign up / sign in (magic link or password), create and list notes belonging only to that user.',
    'A second browser/session cannot see the first user’s notes; live demo accounts or seed users documented in README.',
    'Any web stack with auth'
  )
on conflict (slug) do nothing;

alter table exam_briefs enable row level security;
drop policy if exists exam_briefs_read on exam_briefs;
create policy exam_briefs_read on exam_briefs
  for select to authenticated using (active = true or is_admin());

-- ---------------------------------------------------------------------------
-- Build exam attempts
-- ---------------------------------------------------------------------------
create table if not exists build_exams (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references profiles(id),
  brief_id uuid not null references exam_briefs(id),
  status text not null default 'in_progress'
    check (status in (
      'in_progress', 'submitted', 'admin_questions', 'approved', 'rejected', 'expired'
    )),
  started_at timestamptz not null default now(),
  due_at timestamptz not null,
  submitted_at timestamptz,
  github_url text,
  live_url text,
  -- Auto analysis (heuristics / optional LLM) — advisory for admin
  auto_score_overall integer check (auto_score_overall between 0 and 100),
  auto_score_detail jsonb not null default '{}'::jsonb,
  auto_analyzed_at timestamptz,
  -- Admin
  admin_question text,
  developer_reply text,
  reviewer_notes text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  -- If still submitted/admin_questions with no decision after this → auto approve
  review_deadline_at timestamptz,
  auto_approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists build_exams_dev_idx on build_exams (developer_id, created_at desc);
create index if not exists build_exams_status_idx on build_exams (status, review_deadline_at);

alter table build_exams enable row level security;

drop policy if exists build_exams_dev_read on build_exams;
create policy build_exams_dev_read on build_exams
  for select to authenticated
  using (developer_id = auth.uid() or is_admin());

drop policy if exists build_exams_dev_update on build_exams;
create policy build_exams_dev_update on build_exams
  for update to authenticated
  using (developer_id = auth.uid() or is_admin())
  with check (developer_id = auth.uid() or is_admin());

-- Duration of the timed build window
create or replace function exam_window_hours()
returns integer language sql immutable as $$ select 5 $$;

create or replace function exam_admin_sla_hours()
returns integer language sql immutable as $$ select 48 $$;

create or replace function start_build_exam()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dev uuid := auth.uid();
  v_brief uuid;
  v_exam uuid;
begin
  if v_dev is null then raise exception 'Sign in required'; end if;
  if not exists (select 1 from profiles where id = v_dev and role = 'developer') then
    raise exception 'Only developers can start the build exam';
  end if;
  if not exists (
    select 1 from developer_profiles
     where profile_id = v_dev and identity_status = 'approved'
  ) then
    raise exception 'Government ID must be approved before the build exam';
  end if;
  if exists (
    select 1 from developer_profiles
     where profile_id = v_dev and interview_status = 'approved'
  ) then
    raise exception 'Build exam already approved';
  end if;
  if exists (
    select 1 from build_exams
     where developer_id = v_dev
       and status in ('in_progress', 'submitted', 'admin_questions')
  ) then
    raise exception 'You already have an open build exam';
  end if;

  select id into v_brief
    from exam_briefs
   where active
   order by random()
   limit 1;
  if v_brief is null then
    raise exception 'No exam briefs configured';
  end if;

  insert into build_exams (developer_id, brief_id, due_at)
  values (
    v_dev,
    v_brief,
    now() + make_interval(hours => exam_window_hours())
  )
  returning id into v_exam;

  update developer_profiles
     set interview_status = 'submitted'
   where profile_id = v_dev
     and interview_status in ('not_started', 'rejected');

  perform write_audit_event('exam.start', 'build_exam', v_exam, '{}'::jsonb);
  return v_exam;
end;
$$;

revoke all on function start_build_exam() from public;
grant execute on function start_build_exam() to authenticated;

create or replace function submit_build_exam(
  p_exam_id uuid,
  p_github_url text,
  p_live_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam build_exams%rowtype;
begin
  select * into v_exam from build_exams where id = p_exam_id for update;
  if not found then raise exception 'Exam not found'; end if;
  if v_exam.developer_id is distinct from auth.uid() then
    raise exception 'Not your exam';
  end if;
  if v_exam.status is distinct from 'in_progress' then
    raise exception 'Exam is not open for submission';
  end if;
  if now() > v_exam.due_at then
    update build_exams set status = 'expired' where id = p_exam_id;
    raise exception 'Exam time window has ended (% hours)', exam_window_hours();
  end if;
  if p_github_url is null or p_github_url !~* '^https?://'
     or p_live_url is null or p_live_url !~* '^https?://' then
    raise exception 'Provide public https GitHub and live URLs';
  end if;

  update build_exams
     set status = 'submitted',
         submitted_at = now(),
         github_url = trim(p_github_url),
         live_url = trim(p_live_url),
         review_deadline_at = now() + make_interval(hours => exam_admin_sla_hours())
   where id = p_exam_id;

  perform write_audit_event('exam.submit', 'build_exam', p_exam_id, '{}'::jsonb);
end;
$$;

revoke all on function submit_build_exam(uuid, text, text) from public;
grant execute on function submit_build_exam(uuid, text, text) to authenticated;

create or replace function reply_build_exam(p_exam_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reply is null or length(trim(p_reply)) < 8 then
    raise exception 'Reply is too short';
  end if;
  update build_exams
     set developer_reply = trim(p_reply),
         status = 'submitted',
         review_deadline_at = greatest(
           coalesce(review_deadline_at, now()),
           now() + interval '24 hours'
         )
   where id = p_exam_id
     and developer_id = auth.uid()
     and status = 'admin_questions';
  if not found then
    raise exception 'No open admin question on this exam';
  end if;
end;
$$;

revoke all on function reply_build_exam(uuid, text) from public;
grant execute on function reply_build_exam(uuid, text) to authenticated;

create or replace function admin_ask_build_exam(p_exam_id uuid, p_question text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  if p_question is null or length(trim(p_question)) < 8 then
    raise exception 'Question too short';
  end if;
  update build_exams
     set status = 'admin_questions',
         admin_question = trim(p_question),
         developer_reply = null,
         review_deadline_at = now() + make_interval(hours => exam_admin_sla_hours())
   where id = p_exam_id
     and status in ('submitted', 'admin_questions');
  if not found then raise exception 'Exam not awaiting review'; end if;
end;
$$;

revoke all on function admin_ask_build_exam(uuid, text) from public;
grant execute on function admin_ask_build_exam(uuid, text) to authenticated;

create or replace function admin_decide_build_exam(
  p_exam_id uuid,
  p_approve boolean,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam build_exams%rowtype;
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  select * into v_exam from build_exams where id = p_exam_id for update;
  if not found then raise exception 'Exam not found'; end if;
  if v_exam.status not in ('submitted', 'admin_questions') then
    raise exception 'Exam not reviewable';
  end if;

  if p_approve then
    update build_exams
       set status = 'approved',
           reviewer_notes = nullif(trim(p_notes), ''),
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = p_exam_id;
    update developer_profiles
       set interview_status = 'approved'
     where profile_id = v_exam.developer_id;
  else
    update build_exams
       set status = 'rejected',
           reviewer_notes = nullif(trim(p_notes), ''),
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = p_exam_id;
    update developer_profiles
       set interview_status = 'rejected'
     where profile_id = v_exam.developer_id;
  end if;

  perform write_audit_event(
    case when p_approve then 'exam.approve' else 'exam.reject' end,
    'build_exam',
    p_exam_id,
    '{}'::jsonb
  );
end;
$$;

revoke all on function admin_decide_build_exam(uuid, boolean, text) from public;
grant execute on function admin_decide_build_exam(uuid, boolean, text) to authenticated;

-- Auto-approve when admin SLA lapses (call from app/edge periodically)
create or replace function process_build_exam_auto_approvals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id, developer_id
      from build_exams
     where status in ('submitted', 'admin_questions')
       and review_deadline_at is not null
       and review_deadline_at < now()
  loop
    update build_exams
       set status = 'approved',
           auto_approved_at = now(),
           reviewed_at = now(),
           reviewer_notes = coalesce(reviewer_notes, 'Auto-approved: admin did not act within 48 hours.')
     where id = r.id;
    update developer_profiles
       set interview_status = 'approved'
     where profile_id = r.developer_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function process_build_exam_auto_approvals() from public;
grant execute on function process_build_exam_auto_approvals() to authenticated;

-- Store auto-analysis results (called by edge with service role or admin)
create or replace function save_exam_auto_score(
  p_exam_id uuid,
  p_overall integer,
  p_detail jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Developer may trigger analysis on their own submitted exam; admin too.
  if not is_admin() and not exists (
    select 1 from build_exams where id = p_exam_id and developer_id = auth.uid()
  ) then
    -- service role bypasses; authenticated edge uses user JWT after submit
    if auth.uid() is not null then
      raise exception 'Not allowed';
    end if;
  end if;

  update build_exams
     set auto_score_overall = greatest(0, least(100, p_overall)),
         auto_score_detail = coalesce(p_detail, '{}'::jsonb),
         auto_analyzed_at = now()
   where id = p_exam_id;
end;
$$;

revoke all on function save_exam_auto_score(uuid, integer, jsonb) from public;
grant execute on function save_exam_auto_score(uuid, integer, jsonb) to authenticated;

-- Bid gate: identity + approved build exam + membership + not blocked
create or replace function enforce_bid_eligibility()
returns trigger
language plpgsql
as $$
declare
  v_identity verification_status;
  v_interview verification_status;
  v_unlocked timestamptz;
  v_blocked timestamptz;
  v_stage project_stage;
begin
  -- Opportunistically clear auto-approvals
  perform process_build_exam_auto_approvals();

  select identity_status, interview_status, bidding_unlocked_at, platform_blocked_at
    into v_identity, v_interview, v_unlocked, v_blocked
    from developer_profiles
   where profile_id = new.developer_id;

  if v_blocked is not null then
    raise exception 'This developer account is blocked from bidding on Okavo';
  end if;
  if v_identity is distinct from 'approved' then
    raise exception 'Identity must be approved before bidding';
  end if;
  if v_interview is distinct from 'approved' then
    raise exception 'Build exam must be approved before bidding';
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
-- Hire success fee (10% of awarded bid) — anti-leakage
-- ---------------------------------------------------------------------------
alter table payments
  add column if not exists bid_id uuid references bids(id);

create or replace function hire_success_fee_paid(p_bid_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from payments
     where bid_id = p_bid_id
       and purpose = 'platform_fee'
       and status = 'paid'
  );
$$;

revoke all on function hire_success_fee_paid(uuid) from public;
grant execute on function hire_success_fee_paid(uuid) to authenticated;
