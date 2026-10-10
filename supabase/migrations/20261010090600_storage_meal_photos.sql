-- Private storage for meal photos.
--
-- The bucket is private, so a photo is only reachable through a signed URL or
-- an authenticated request. Each user's files live under a folder named after
-- their user id, and the policies below enforce that: the first path segment
-- must equal the caller's uid.
--
-- Photos are only written here when the user has turned on "Keep my meal
-- photos". By default the analysis function deletes the upload immediately
-- after reading it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-photos',
  'meal-photos',
  false,
  -- 5 MB. The app compresses to well under this before uploading.
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- `storage.foldername(name)` splits an object path; element 1 is the first
-- folder. Comparing it to the uid is what scopes each user to their own folder.

create policy "meal-photos: read own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "meal-photos: upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "meal-photos: replace own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "meal-photos: delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
