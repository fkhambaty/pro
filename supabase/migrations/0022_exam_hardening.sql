-- 0022: Harden the timed build exam.
-- Auto-approval is deliberately narrow: score >= 70, 48 hours elapsed,
-- no global pause, and no per-exam hold. Everything else stays for a person.

-- ---------------------------------------------------------------------------
-- Larger curated bank and fair rotation
-- ---------------------------------------------------------------------------

alter table exam_briefs
  add column if not exists assignment_count integer not null default 0,
  add column if not exists last_assigned_at timestamptz;

insert into exam_briefs (slug, title, summary, acceptance, stack_hint)
values
  (
    'expense-splitter',
    'Shared expense splitter',
    'Build a small trip-expense app. Add people and expenses, choose who paid, and show the simplest balances needed to settle up.',
    'Users can add and remove people and expenses; totals remain after refresh; balances add up correctly; README includes run steps.',
    'Any web stack'
  ),
  (
    'support-inbox',
    'Mini support inbox',
    'Build an inbox with seeded support tickets. Filter by open/closed, open a ticket, add a reply, and close or reopen it.',
    'Filters and status changes work; replies remain after refresh; a direct link can reopen a ticket; README includes run steps.',
    'Any web stack'
  ),
  (
    'inventory-alerts',
    'Low-stock inventory',
    'Build an inventory list where a user can add products, record stock changes, and filter products below a configurable threshold.',
    'Stock cannot become negative; low-stock filtering works; data survives refresh; README explains setup and trade-offs.',
    'Any web stack'
  ),
  (
    'event-rsvp',
    'Event RSVP page',
    'Build an event page with capacity, guest RSVP form, attendee list, and cancellation using a generated confirmation code.',
    'Capacity is enforced; duplicate email RSVPs are handled; cancellation frees a place; README includes run steps.',
    'Any web stack'
  ),
  (
    'reading-list',
    'Personal reading list',
    'Build a reading tracker. Add a book, move it between To read / Reading / Finished, rate finished books, and search by title.',
    'State changes and search work; ratings are limited to finished books; data survives refresh; README includes run steps.',
    'Any web stack'
  ),
  (
    'poll-builder',
    'One-question polls',
    'Build a poll creator with two to six choices, a shareable voting page, one vote per browser, and a results view.',
    'Invalid polls are blocked; voting updates results; repeat voting is prevented in the same browser; README states limitations.',
    'Any web stack'
  ),
  (
    'habit-streak',
    'Habit streak tracker',
    'Build a weekly habit tracker. Create habits, mark days complete, and show current and best streaks.',
    'A day cannot be counted twice; streak calculations are correct across missed days; state survives refresh; README includes run steps.',
    'Any web stack'
  ),
  (
    'link-shortener',
    'Mini link manager',
    'Build a link manager that creates short aliases, redirects aliases, counts visits, and lets the owner disable a link.',
    'Aliases are unique; disabled links do not redirect; visit counts update; unsafe non-http destinations are rejected; README includes run steps.',
    'Any web stack'
  )
on conflict (slug) do nothing;

update exam_briefs b
set assignment_count = history.assignment_count,
    last_assigned_at = history.last_assigned_at
from (
  select brief_id, count(*)::integer as assignment_count, max(started_at) as last_assigned_at
  from build_exams
  group by brief_id
) history
where b.id = history.brief_id;

-- ---------------------------------------------------------------------------
-- Operational controls and review signals
-- ---------------------------------------------------------------------------

create table if not exists exam_controls (
  singleton boolean primary key default true check (singleton),
  starts_paused boolean not null default false,
  auto_approve_paused boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

insert into exam_controls (singleton) values (true)
on conflict (singleton) do nothing;

alter table exam_controls enable row level security;
drop policy if exists exam_controls_read on exam_controls;
create policy exam_controls_read on exam_controls
  for select to authenticated using (true);
grant select on table exam_controls to authenticated;

alter table build_exams
  add column if not exists auto_approval_hold boolean not null default false,
  add column if not exists auto_approval_hold_reason text,
  add column if not exists normalized_repo_url text,
  add column if not exists duplicate_repo boolean not null default false,
  add column if not exists duplicate_of_exam_id uuid references build_exams(id);

create index if not exists build_exams_normalized_repo_idx
  on build_exams (normalized_repo_url)
  where normalized_repo_url is not null;

create or replace function normalize_exam_repo_url(p_url text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(trim(coalesce(p_url, '')));
begin
  v := regexp_replace(v, '[?#].*$', '');
  v := regexp_replace(v, '/+$', '');
  v := regexp_replace(v, '\.git$', '');
  v := regexp_replace(v, '^https://www\.github\.com/', 'https://github.com/');
  v := regexp_replace(v, '^https://www\.gitlab\.com/', 'https://gitlab.com/');
  if v ~ '^https://github\.com/' then
    v := regexp_replace(v, '^(https://github\.com/[^/]+/[^/]+).*$', '\1');
  else
    v := regexp_replace(v, '/-/.*$', '');
  end if;
  v := regexp_replace(v, '\.git$', '');
  return nullif(v, '');
end;
$$;

update build_exams
set normalized_repo_url = normalize_exam_repo_url(github_url)
where github_url is not null
  and normalized_repo_url is null;

with duplicate_repos as (
  select normalized_repo_url
  from build_exams
  where normalized_repo_url is not null
  group by normalized_repo_url
  having count(*) > 1
)
update build_exams e
set duplicate_repo = true
from duplicate_repos d
where e.normalized_repo_url = d.normalized_repo_url;

-- Exam content is changed only through narrow RPCs, never arbitrary updates.
revoke update on table build_exams from authenticated;
revoke insert on table build_exams from authenticated;
revoke update on table exam_controls from authenticated;

create or replace function exam_guard_text(p_kind text, p_text text)
returns text
language plpgsql
immutable
as $$
declare
  v text := trim(coalesce(p_text, ''));
  v_min integer := 8;
  v_max integer := 2000;
begin
  if p_kind not in ('question', 'reply') then
    raise exception 'Unknown exam text kind';
  end if;
  if length(v) < v_min then
    raise exception 'Exam % is too short', p_kind;
  end if;
  if length(v) > v_max then
    raise exception 'Exam % is too long', p_kind;
  end if;
  if v ~* '(ignore[[:space:]]+(all[[:space:]]+)?(previous|prior|above)[[:space:]]+(instructions|rules)|system[[:space:]]*prompt|you[[:space:]]+are[[:space:]]+now[[:space:]]+(dan|jailbreak|unrestricted)|disregard[[:space:]]+(the[[:space:]]+)?(system|lock|scope))' then
    raise exception 'Exam % contains unsafe instruction-like text', p_kind;
  end if;
  if v ~* '(https?://[^[:space:]]+[[:space:]]*){5,}' then
    raise exception 'Exam % contains too many links', p_kind;
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Start, submit, Q&A, and scoring
-- ---------------------------------------------------------------------------

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
  perform pg_advisory_xact_lock(hashtext('okavo.build_exam.controls'));
  if (select starts_paused from exam_controls where singleton) then
    raise exception 'New build exams are temporarily paused. Please try again later.';
  end if;
  -- Serialize the small UTC-day quota check so simultaneous starts cannot
  -- both observe the tenth place as available.
  perform pg_advisory_xact_lock(hashtext('okavo.build_exam.daily_cap'));
  if (
    select count(*)
    from build_exams
    where (started_at at time zone 'UTC')::date = (now() at time zone 'UTC')::date
  ) >= 10 then
    raise exception 'Today''s build exam places are full. New places open at 00:00 UTC.';
  end if;
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
  order by assignment_count asc, last_assigned_at asc nulls first, random()
  limit 1
  for update skip locked;
  if v_brief is null then raise exception 'No exam briefs configured'; end if;

  update exam_briefs
  set assignment_count = assignment_count + 1,
      last_assigned_at = now()
  where id = v_brief;

  insert into build_exams (developer_id, brief_id, due_at)
  values (v_dev, v_brief, now() + make_interval(hours => exam_window_hours()))
  returning id into v_exam;

  update developer_profiles
  set interview_status = 'submitted'
  where profile_id = v_dev
    and interview_status in ('not_started', 'rejected');

  perform write_audit_event(
    'exam.start',
    'build_exam',
    v_exam,
    jsonb_build_object('brief_id', v_brief)
  );
  return v_exam;
end;
$$;

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
  v_repo text;
  v_duplicate uuid;
begin
  select * into v_exam from build_exams where id = p_exam_id for update;
  if not found then raise exception 'Exam not found'; end if;
  if v_exam.developer_id is distinct from auth.uid() then raise exception 'Not your exam'; end if;
  if v_exam.status is distinct from 'in_progress' then
    raise exception 'Exam is not open for submission';
  end if;
  if now() > v_exam.due_at then
    update build_exams set status = 'expired' where id = p_exam_id;
    raise exception 'Exam time window has ended (% hours)', exam_window_hours();
  end if;
  if trim(coalesce(p_github_url, '')) !~* '^https://(www\.)?(github\.com|gitlab\.com)/[^/?#]+/[^/?#]+([/?#].*)?$' then
    raise exception 'Provide an HTTPS GitHub or GitLab repository URL';
  end if;
  if trim(coalesce(p_live_url, '')) !~* '^https://[^[:space:]]+$' then
    raise exception 'Provide a public HTTPS live URL';
  end if;

  v_repo := normalize_exam_repo_url(p_github_url);
  select id into v_duplicate
  from build_exams
  where id <> p_exam_id
    and normalized_repo_url = v_repo
  order by created_at
  limit 1;

  update build_exams
  set status = 'submitted',
      submitted_at = now(),
      github_url = trim(p_github_url),
      live_url = trim(p_live_url),
      normalized_repo_url = v_repo,
      duplicate_repo = v_duplicate is not null,
      duplicate_of_exam_id = v_duplicate,
      review_deadline_at = now() + make_interval(hours => exam_admin_sla_hours())
  where id = p_exam_id;

  if v_duplicate is not null then
    update build_exams set duplicate_repo = true
    where id = v_duplicate;
  end if;

  perform write_audit_event(
    'exam.submit',
    'build_exam',
    p_exam_id,
    jsonb_build_object(
      'normalized_repo_url', v_repo,
      'duplicate_of_exam_id', v_duplicate
    )
  );
end;
$$;

create or replace function reply_build_exam(p_exam_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update build_exams
  set developer_reply = exam_guard_text('reply', p_reply),
      status = 'submitted',
      review_deadline_at = greatest(
        coalesce(review_deadline_at, now()),
        now() + interval '24 hours'
      )
  where id = p_exam_id
    and developer_id = auth.uid()
    and status = 'admin_questions';
  if not found then raise exception 'No open admin question on this exam'; end if;
  perform write_audit_event('exam.reply', 'build_exam', p_exam_id, '{}'::jsonb);
end;
$$;

create or replace function admin_ask_build_exam(p_exam_id uuid, p_question text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  update build_exams
  set status = 'admin_questions',
      admin_question = exam_guard_text('question', p_question),
      developer_reply = null,
      auto_approval_hold = true,
      auto_approval_hold_reason = 'Admin requested more information.',
      review_deadline_at = now() + make_interval(hours => exam_admin_sla_hours())
  where id = p_exam_id
    and status in ('submitted', 'admin_questions');
  if not found then raise exception 'Exam not awaiting review'; end if;
  perform write_audit_event('exam.question', 'build_exam', p_exam_id, '{}'::jsonb);
end;
$$;

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
  if p_overall is null or p_overall < 0 or p_overall > 100 then
    raise exception 'Score must be between 0 and 100';
  end if;
  if coalesce(auth.role(), '') <> 'service_role' and not is_admin() and not exists (
    select 1 from build_exams
    where id = p_exam_id
      and developer_id = auth.uid()
      and status in ('submitted', 'admin_questions')
  ) then
    raise exception 'Not allowed';
  end if;

  update build_exams
  set auto_score_overall = p_overall,
      auto_score_detail = coalesce(p_detail, '{}'::jsonb),
      auto_analyzed_at = now()
  where id = p_exam_id
    and status in ('submitted', 'admin_questions');
  if not found then raise exception 'Exam is not reviewable'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin controls and score-gated auto-approval
-- ---------------------------------------------------------------------------

create or replace function admin_set_exam_pauses(
  p_starts_paused boolean,
  p_auto_approve_paused boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  perform pg_advisory_xact_lock(hashtext('okavo.build_exam.controls'));
  update exam_controls
  set starts_paused = p_starts_paused,
      auto_approve_paused = p_auto_approve_paused,
      updated_at = now(),
      updated_by = auth.uid()
  where singleton;
  perform write_audit_event(
    'exam.controls.update',
    'exam_controls',
    auth.uid(),
    jsonb_build_object(
      'starts_paused', p_starts_paused,
      'auto_approve_paused', p_auto_approve_paused
    )
  );
end;
$$;

revoke all on function admin_set_exam_pauses(boolean, boolean) from public;
grant execute on function admin_set_exam_pauses(boolean, boolean) to authenticated;

create or replace function admin_set_exam_hold(
  p_exam_id uuid,
  p_hold boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  if p_hold and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Add a short reason for the hold';
  end if;
  update build_exams
  set auto_approval_hold = p_hold,
      auto_approval_hold_reason = case
        when p_hold then left(trim(p_reason), 500)
        else null
      end
  where id = p_exam_id
    and status in ('submitted', 'admin_questions');
  if not found then raise exception 'Exam not awaiting review'; end if;
  perform write_audit_event(
    case when p_hold then 'exam.hold.set' else 'exam.hold.clear' end,
    'build_exam',
    p_exam_id,
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), ''))
  );
end;
$$;

revoke all on function admin_set_exam_hold(uuid, boolean, text) from public;
grant execute on function admin_set_exam_hold(uuid, boolean, text) to authenticated;

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
  perform pg_advisory_xact_lock(hashtext('okavo.build_exam.controls'));
  if (select auto_approve_paused from exam_controls where singleton) then
    return 0;
  end if;

  for r in
    select id, developer_id
    from build_exams
    where status in ('submitted', 'admin_questions')
      and review_deadline_at is not null
      and review_deadline_at < now()
      and auto_score_overall >= 70
      and not auto_approval_hold
    for update skip locked
  loop
    update build_exams
    set status = 'approved',
        auto_approved_at = now(),
        reviewed_at = now(),
        reviewer_notes = coalesce(
          reviewer_notes,
          'Auto-approved after 48 hours with a score of at least 70.'
        )
    where id = r.id;
    update developer_profiles
    set interview_status = 'approved'
    where profile_id = r.developer_id;
    insert into audit_events (actor_id, entity_type, entity_id, action, detail)
    values (
      null,
      'build_exam',
      r.id,
      'exam.auto_approve',
      jsonb_build_object('minimum_score', 70)
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Keep grants explicit after replacing RPCs.
revoke all on function start_build_exam() from public;
grant execute on function start_build_exam() to authenticated;
revoke all on function submit_build_exam(uuid, text, text) from public;
grant execute on function submit_build_exam(uuid, text, text) to authenticated;
revoke all on function reply_build_exam(uuid, text) from public;
grant execute on function reply_build_exam(uuid, text) to authenticated;
revoke all on function admin_ask_build_exam(uuid, text) from public;
grant execute on function admin_ask_build_exam(uuid, text) to authenticated;
revoke all on function save_exam_auto_score(uuid, integer, jsonb) from public;
grant execute on function save_exam_auto_score(uuid, integer, jsonb) to authenticated;
grant execute on function save_exam_auto_score(uuid, integer, jsonb) to service_role;

comment on table exam_controls is
  'Singleton operational switches for exam starts and score-gated auto-approval.';
comment on column build_exams.duplicate_repo is
  'Review signal only. Duplicate and forked repositories are never automatically rejected.';
