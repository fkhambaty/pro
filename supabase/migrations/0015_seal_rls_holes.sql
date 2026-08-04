-- Seal critical RLS and authorization holes found in production audit.

-- ---------------------------------------------------------------------------
-- Developers must not self-approve identity, self-unlock bidding, or raise tier
-- ---------------------------------------------------------------------------

create or replace function protect_developer_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / definer triggers (membership unlock, admin RPCs) have no JWT.
  if auth.uid() is null then
    return new;
  end if;

  if is_admin() then
    return new;
  end if;

  if auth.uid() is distinct from old.profile_id then
    raise exception 'Not allowed to update this developer profile';
  end if;

  -- Only service-role / triggers may change these. Self-service fields stay editable.
  new.identity_status := old.identity_status;
  new.interview_status := old.interview_status;
  new.tier := old.tier;
  new.bidding_unlocked_at := old.bidding_unlocked_at;
  new.contracts_delivered := old.contracts_delivered;
  new.first_pass_acceptance := old.first_pass_acceptance;
  new.disputes_lost := old.disputes_lost;

  return new;
end;
$$;

drop trigger if exists developer_profiles_protect on developer_profiles;
create trigger developer_profiles_protect
  before update on developer_profiles
  for each row execute function protect_developer_profile_columns();

-- ---------------------------------------------------------------------------
-- Identity / interview decisions are admin-only
-- ---------------------------------------------------------------------------

drop policy if exists verification_review on identity_verifications;
create policy verification_review on identity_verifications
  for update using (is_admin());

drop policy if exists interview_review on interview_assessments;
create policy interview_review on interview_assessments
  for update using (is_admin());

-- ---------------------------------------------------------------------------
-- Nobody may mint themselves as admin via profiles insert/update
-- ---------------------------------------------------------------------------

create or replace function protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_admin boolean;
begin
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ) into actor_is_admin;

  -- Service role / triggers run with auth.uid() null — allow (seed, hooks).
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'admin' and not actor_is_admin then
      new.role := 'buyer';
    end if;
    if new.role not in ('buyer', 'developer', 'admin') then
      new.role := 'buyer';
    end if;
    if new.id is distinct from auth.uid() then
      raise exception 'Cannot create a profile for another user';
    end if;
    return new;
  end if;

  -- UPDATE: non-admins cannot change role at all.
  if not actor_is_admin then
    new.role := old.role;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_role on profiles;
create trigger profiles_protect_role
  before insert or update on profiles
  for each row execute function protect_profile_role();

-- Client auth.tsx still passes metadata; clamp admin there too via this trigger.

-- ---------------------------------------------------------------------------
-- Project visibility: buyers see own; developers see open board; admin all
-- ---------------------------------------------------------------------------

drop policy if exists projects_read on projects;
create policy projects_read on projects
  for select using (
    is_admin()
    or buyer_id = auth.uid()
    or (
      stage in ('locked', 'hired', 'in_delivery', 'delivered', 'closed')
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
            p.stage in ('locked', 'hired', 'in_delivery', 'delivered', 'closed')
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
-- Dispute resolution: admin only (UI claimed Okavo review)
-- ---------------------------------------------------------------------------

create or replace function resolve_dispute_against_scope(
  p_dispute_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dispute_row disputes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not is_admin() then
    raise exception 'Only Okavo can resolve a dispute';
  end if;

  select * into dispute_row from disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'Dispute not found';
  end if;

  if dispute_row.status like 'resolved%' then
    return;
  end if;

  update disputes
     set status = 'resolved_buyer',
         resolution_note = coalesce(nullif(trim(p_note), ''), 'Resolved against the locked scope.'),
         resolved_by = auth.uid(),
         resolved_at = now()
   where id = p_dispute_id;

  update contracts
     set status = 'active',
         updated_at = now()
   where id = dispute_row.contract_id
     and status = 'disputed';
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments: clients must never insert (edge functions use service role)
-- ---------------------------------------------------------------------------

drop policy if exists payments_insert on payments;
-- No client insert policy. Service role bypasses RLS.

-- Restore Arjun test mutation from the audit probe if still set in the future:
-- (no-op here; applied separately if needed)

create or replace function accept_project_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row project_invites%rowtype;
  caller_email text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select email into caller_email from profiles where id = auth.uid();
  if caller_email is null then raise exception 'Profile missing'; end if;

  select * into invite_row from project_invites where token = p_token for update;
  if not found then raise exception 'Invite not found'; end if;
  if invite_row.expires_at < now() then raise exception 'Invite expired'; end if;
  if invite_row.accepted_by is not null then return invite_row.project_id; end if;
  if lower(invite_row.email) is distinct from lower(caller_email) then
    raise exception 'Sign in with % to accept this invite', invite_row.email;
  end if;

  update project_invites set accepted_by = auth.uid() where id = invite_row.id;
  return invite_row.project_id;
end;
$$;

revoke all on function accept_project_invite(text) from public;
grant execute on function accept_project_invite(text) to authenticated;
