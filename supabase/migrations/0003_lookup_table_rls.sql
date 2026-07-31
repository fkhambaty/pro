-- Row level security for the three lookup tables missed in 0001.
--
-- Supabase grants the anon and authenticated roles full CRUD on public schema
-- tables by default and relies on RLS to restrict them, so a table without RLS
-- is effectively open. Skills are public reference data: readable by everyone,
-- writable by nobody through the API.

alter table skills enable row level security;
alter table developer_skills enable row level security;
alter table project_skills enable row level security;

drop policy if exists skills_read on skills;
create policy skills_read on skills
  for select using (true);

drop policy if exists developer_skills_read on developer_skills;
create policy developer_skills_read on developer_skills
  for select using (true);

-- A developer manages only their own skill tags.
drop policy if exists developer_skills_own on developer_skills;
create policy developer_skills_own on developer_skills
  for all using (developer_id = auth.uid())
  with check (developer_id = auth.uid());

drop policy if exists project_skills_read on project_skills;
create policy project_skills_read on project_skills
  for select using (
    exists (
      select 1 from projects p
      where p.id = project_id
        and (p.stage <> 'drafting' or p.buyer_id = auth.uid() or is_admin())
    )
  );

-- Only the buyer who owns the project may tag it.
drop policy if exists project_skills_own on project_skills;
create policy project_skills_own on project_skills
  for all using (
    exists (select 1 from projects p where p.id = project_id and p.buyer_id = auth.uid())
    or is_admin()
  )
  with check (
    exists (select 1 from projects p where p.id = project_id and p.buyer_id = auth.uid())
  );
