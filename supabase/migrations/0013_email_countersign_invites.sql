-- Transactional email dispatch, developer countersign, invites, dispute notify.
--
-- Emails: notify_profile HTTP POSTs to the notify-user edge function.
-- Secrets cannot be set via ALTER DATABASE through the SQL API — use
-- private.okavo_config (see 0014_private_notify_config.sql):
--   insert into private.okavo_config(key, value) values
--     ('notify_secret', '<NOTIFY_SECRET>'),
--     ('notify_user_url', 'https://<project>.supabase.co/functions/v1/notify-user')
--   on conflict (key) do update set value = excluded.value;

create extension if not exists pg_net with schema extensions;

alter table notifications
  add column if not exists email_dispatched_at timestamptz;

create or replace function notify_profile(
  target uuid,
  kind notification_kind,
  title text,
  body text,
  link_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  secret text;
  endpoint text;
  request_id bigint;
begin
  if target is null then return; end if;

  insert into notifications (profile_id, kind, title, body, link_path)
  values (target, kind, title, body, link_path)
  returning id into new_id;

  begin
    secret := nullif(current_setting('app.settings.okavo_notify_secret', true), '');
    endpoint := nullif(current_setting('app.settings.okavo_functions_url', true), '');
  exception when others then
    secret := null;
    endpoint := null;
  end;

  if secret is null or endpoint is null then
    return;
  end if;

  begin
    select net.http_post(
      url := endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-okavo-notify', secret
      ),
      body := jsonb_build_object(
        'profile_id', target,
        'title', title,
        'body', body,
        'link_path', link_path,
        'cta', 'Open in Okavo'
      )
    ) into request_id;

    update notifications
       set email_dispatched_at = now()
     where id = new_id;
  exception when others then
    -- Never fail the marketplace write because mail is down.
    raise warning 'notify_profile email dispatch failed: %', sqlerrm;
  end;
end;
$$;

-- Identity reject copy used the wrong column.
create or replace function on_identity_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then return null; end if;

  if new.status = 'approved' then
    perform notify_profile(
      new.developer_id, 'verification', 'Identity approved',
      'You can now bid on any locked requirement.', '/app/verification'
    );
  elsif new.status = 'rejected' then
    perform notify_profile(
      new.developer_id, 'verification', 'Identity needs another look',
      coalesce(new.rejection_reason, 'Please re-submit your document.'),
      '/app/verification'
    );
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Developer must countersign the frozen lock before delivery starts
-- ---------------------------------------------------------------------------

create or replace function countersign_contract(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_row contracts%rowtype;
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

revoke all on function countersign_contract(uuid) from public;
grant execute on function countersign_contract(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invite a builder into a locked brief
-- ---------------------------------------------------------------------------

create table if not exists project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  invited_by uuid not null references profiles (id) on delete cascade,
  email text not null,
  token text not null unique,
  accepted_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create index if not exists project_invites_project_idx on project_invites (project_id);
create index if not exists project_invites_email_idx on project_invites (lower(email));

alter table project_invites enable row level security;

drop policy if exists project_invites_buyer_read on project_invites;
create policy project_invites_buyer_read on project_invites
  for select using (
    invited_by = auth.uid()
    or exists (
      select 1 from projects p
      where p.id = project_id and p.buyer_id = auth.uid()
    )
    or is_admin()
  );

drop policy if exists project_invites_buyer_insert on project_invites;
create policy project_invites_buyer_insert on project_invites
  for insert with check (
    invited_by = auth.uid()
    and exists (
      select 1 from projects p
      where p.id = project_id
        and p.buyer_id = auth.uid()
        and p.stage <> 'drafting'
    )
  );

create or replace function invite_builder_to_project(p_project_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row projects%rowtype;
  invite_id uuid;
  token text;
  clean_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  clean_email := lower(trim(p_email));
  if clean_email is null or position('@' in clean_email) = 0 then
    raise exception 'Enter a valid email address';
  end if;

  select * into project_row from projects where id = p_project_id;
  if not found then
    raise exception 'Project not found';
  end if;

  if project_row.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can invite a builder';
  end if;

  if project_row.stage = 'drafting' then
    raise exception 'Lock the requirement before inviting a builder';
  end if;

  token := encode(gen_random_bytes(24), 'hex');

  insert into project_invites (project_id, invited_by, email, token)
  values (p_project_id, auth.uid(), clean_email, token)
  returning id into invite_id;

  -- Email goes through notify-user using the invite email directly.
  begin
    perform net.http_post(
      url := nullif(current_setting('app.settings.okavo_functions_url', true), ''),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-okavo-notify', nullif(current_setting('app.settings.okavo_notify_secret', true), '')
      ),
      body := jsonb_build_object(
        'email', clean_email,
        'title', 'You are invited to bid on a locked Okavo brief',
        'body', 'A buyer locked a software requirement and invited you to review the same frozen scope and bid.',
        'link_path', '/app/project/' || p_project_id || '?invite=' || token,
        'cta', 'Open the locked brief'
      )
    );
  exception when others then
    raise warning 'invite email dispatch failed: %', sqlerrm;
  end;

  perform notify_profile(
    auth.uid(),
    'contract',
    'Invite sent',
    'Invitation emailed to ' || clean_email || '.',
    '/app/project/' || p_project_id
  );

  return invite_id;
end;
$$;

revoke all on function invite_builder_to_project(uuid, text) from public;
grant execute on function invite_builder_to_project(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Disputes notify the other party
-- ---------------------------------------------------------------------------

create or replace function on_dispute_raised()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_row contracts%rowtype;
  other_party uuid;
begin
  select * into contract_row from contracts where id = new.contract_id;
  if not found then return null; end if;

  if new.raised_by = contract_row.buyer_id then
    other_party := contract_row.developer_id;
  else
    other_party := contract_row.buyer_id;
  end if;

  perform notify_profile(
    other_party,
    'dispute',
    'Dispute opened on your contract',
    left(new.reason, 180),
    '/app/contract/' || contract_row.project_id
  );

  return null;
end;
$$;

drop trigger if exists disputes_notify on disputes;
create trigger disputes_notify after insert on disputes
  for each row execute function on_dispute_raised();
