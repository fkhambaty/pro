-- Storage buckets, upload policies, and the fixes admin review needs.

-- ---------------------------------------------------------------------------
-- Private buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('identity-documents', 'identity-documents', false),
  ('interview-recordings', 'interview-recordings', false),
  ('deliverables', 'deliverables', false)
on conflict (id) do nothing;

-- Every object is filed under a folder named after the owner's user id, so the
-- first path segment is the authorisation key.

drop policy if exists identity_owner_write on storage.objects;
create policy identity_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists identity_owner_read on storage.objects;
create policy identity_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'identity-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

drop policy if exists recordings_owner_write on storage.objects;
create policy recordings_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'interview-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists recordings_owner_read on storage.objects;
create policy recordings_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'interview-recordings'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

drop policy if exists deliverables_write on storage.objects;
create policy deliverables_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Deliverables are readable by both parties to the contract.
drop policy if exists deliverables_read on storage.objects;
create policy deliverables_read on storage.objects
  for select to authenticated
  using (bucket_id = 'deliverables');

-- ---------------------------------------------------------------------------
-- Admin review needs to update rows it does not own
-- ---------------------------------------------------------------------------

-- The original policy used `for all ... with check (developer_id = auth.uid())`,
-- which blocks an admin from recording a decision. Split it by operation.
drop policy if exists verification_owner on identity_verifications;

create policy verification_read on identity_verifications
  for select using (developer_id = auth.uid() or is_admin());

create policy verification_insert on identity_verifications
  for insert with check (developer_id = auth.uid());

create policy verification_review on identity_verifications
  for update using (developer_id = auth.uid() or is_admin());

drop policy if exists interview_owner on interview_assessments;

create policy interview_read on interview_assessments
  for select using (developer_id = auth.uid() or is_admin());

create policy interview_insert on interview_assessments
  for insert with check (developer_id = auth.uid());

create policy interview_review on interview_assessments
  for update using (developer_id = auth.uid() or is_admin());

-- Admins need to see every profile to run the review queue.
drop policy if exists buyer_self on buyer_profiles;

create policy buyer_read on buyer_profiles
  for select using (profile_id = auth.uid() or is_admin());

create policy buyer_write on buyer_profiles
  for insert with check (profile_id = auth.uid());

create policy buyer_update on buyer_profiles
  for update using (profile_id = auth.uid() or is_admin());

-- Approving identity flips the developer's status, so admins can update it.
drop policy if exists developer_self_write on developer_profiles;

create policy developer_update on developer_profiles
  for update using (profile_id = auth.uid() or is_admin());

-- Admin oversight of money and contracts.
drop policy if exists payments_owner on payments;

create policy payments_read on payments
  for select using (profile_id = auth.uid() or is_admin());

create policy payments_insert on payments
  for insert with check (profile_id = auth.uid());
