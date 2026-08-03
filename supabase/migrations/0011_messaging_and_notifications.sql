-- Messaging and notifications.
--
-- Nothing in the application ever created a message_threads row, so the
-- Messages page could only ever say "No conversations yet" — a buyer and the
-- developer they hired had no way to reach each other. Notifications had the
-- same problem: the table existed and the page rendered, but only the demo
-- code path ever wrote to it.
--
-- Both are created here by database triggers rather than in the client, so a
-- conversation exists no matter which surface placed the bid.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

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
begin
  if target is null then return; end if;
  insert into notifications (profile_id, kind, title, body, link_path)
  values (target, kind, title, body, link_path);
end;
$$;

/**
 * Returns the conversation between a project's buyer and one developer,
 * creating it the first time it is needed. Security definer so either party
 * can open it without being able to write threads for anyone else.
 */
create or replace function ensure_thread(target_project uuid, target_developer uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
  project_row projects%rowtype;
  new_id uuid;
begin
  select * into project_row from projects where id = target_project;
  if not found then
    raise exception 'Project not found';
  end if;

  -- Only the two parties may open this conversation.
  if auth.uid() is not null
     and auth.uid() <> project_row.buyer_id
     and auth.uid() <> target_developer then
    raise exception 'Only the buyer or the developer can open this conversation';
  end if;

  select id into existing
    from message_threads
   where project_id = target_project
     and developer_id = target_developer;

  if existing is not null then
    return existing;
  end if;

  insert into message_threads (project_id, buyer_id, developer_id, subject)
  values (target_project, project_row.buyer_id, target_developer, project_row.title)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function ensure_thread(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- A bid opens a conversation and tells the buyer
-- ---------------------------------------------------------------------------

create or replace function on_bid_placed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row projects%rowtype;
  developer_name text;
begin
  select * into project_row from projects where id = new.project_id;
  select full_name into developer_name from profiles where id = new.developer_id;

  perform ensure_thread(new.project_id, new.developer_id);

  perform notify_profile(
    project_row.buyer_id,
    'bid',
    'New bid received',
    coalesce(developer_name, 'A developer') || ' bid on "' || project_row.title || '".',
    '/app/project/' || new.project_id
  );

  return null;
end;
$$;

drop trigger if exists bids_notify on bids;
create trigger bids_notify after insert on bids
  for each row execute function on_bid_placed();

-- ---------------------------------------------------------------------------
-- Awarding a bid tells the developer they were hired
-- ---------------------------------------------------------------------------

create or replace function on_bid_awarded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row projects%rowtype;
  buyer_name text;
begin
  if new.status <> 'awarded' or old.status = 'awarded' then
    return null;
  end if;

  select * into project_row from projects where id = new.project_id;
  select organization_name into buyer_name
    from buyer_profiles where profile_id = project_row.buyer_id;

  perform ensure_thread(new.project_id, new.developer_id);

  perform notify_profile(
    new.developer_id,
    'contract',
    'You were awarded a contract',
    coalesce(buyer_name, 'A buyer') || ' hired you for "' || project_row.title || '".',
    '/app/contract/' || new.project_id
  );

  return null;
end;
$$;

drop trigger if exists bids_award_notify on bids;
create trigger bids_award_notify after update on bids
  for each row execute function on_bid_awarded();

-- ---------------------------------------------------------------------------
-- A message bumps its thread and tells the other party
-- ---------------------------------------------------------------------------

create or replace function on_message_sent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  thread message_threads%rowtype;
  recipient uuid;
  sender_name text;
begin
  select * into thread from message_threads where id = new.thread_id;
  if not found then return null; end if;

  update message_threads
     set last_message_at = new.created_at
   where id = new.thread_id;

  recipient := case
    when new.sender_id = thread.buyer_id then thread.developer_id
    else thread.buyer_id
  end;

  select full_name into sender_name from profiles where id = new.sender_id;

  perform notify_profile(
    recipient,
    'message',
    'New message from ' || coalesce(sender_name, 'the other party'),
    left(new.body, 140),
    '/app/messages'
  );

  return null;
end;
$$;

drop trigger if exists messages_notify on messages;
create trigger messages_notify after insert on messages
  for each row execute function on_message_sent();

-- ---------------------------------------------------------------------------
-- Milestone movement keeps both sides informed
-- ---------------------------------------------------------------------------

create or replace function on_milestone_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_row contracts%rowtype;
begin
  if new.status = old.status then return null; end if;

  select * into contract_row from contracts where id = new.contract_id;
  if not found then return null; end if;

  if new.status = 'submitted' then
    perform notify_profile(
      contract_row.buyer_id, 'milestone', 'Milestone submitted for review',
      '"' || new.title || '" is ready for you to check against the locked scope.',
      '/app/contract/' || contract_row.project_id
    );
  elsif new.status in ('accepted', 'released') then
    perform notify_profile(
      contract_row.developer_id, 'milestone', 'Milestone accepted',
      'The buyer accepted "' || new.title || '".',
      '/app/contract/' || contract_row.project_id
    );
  elsif new.status = 'funded' then
    perform notify_profile(
      contract_row.developer_id, 'payment', 'Milestone funded',
      '"' || new.title || '" is funded. You can start.',
      '/app/contract/' || contract_row.project_id
    );
  end if;

  return null;
end;
$$;

drop trigger if exists milestones_notify on milestones;
create trigger milestones_notify after update on milestones
  for each row execute function on_milestone_change();

-- ---------------------------------------------------------------------------
-- Identity decisions reach the developer
-- ---------------------------------------------------------------------------

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
      coalesce(new.reviewer_notes, 'Please re-submit your document.'),
      '/app/verification'
    );
  end if;

  return null;
end;
$$;

drop trigger if exists identity_notify on identity_verifications;
create trigger identity_notify after update on identity_verifications
  for each row execute function on_identity_decision();

-- ---------------------------------------------------------------------------
-- Backfill: open a conversation for every bid that already exists
-- ---------------------------------------------------------------------------

insert into message_threads (project_id, buyer_id, developer_id, subject, last_message_at)
select distinct b.project_id, p.buyer_id, b.developer_id, p.title, b.created_at
  from bids b
  join projects p on p.id = b.project_id
 where not exists (
   select 1 from message_threads t
    where t.project_id = b.project_id and t.developer_id = b.developer_id
 );
