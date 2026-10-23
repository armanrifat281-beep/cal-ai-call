-- Private storage for profile pictures.
--
-- Same shape as `meal-photos`: private bucket, one folder per user named
-- after their uid, and policies that compare the first path segment to the
-- caller's uid so nobody can read or write another person's folder.
--
-- `profiles.avatar_url` has existed since the first migration and has never
-- been written. It holds the object's path inside this bucket, not a URL:
-- the bucket is private, so the app signs a short-lived URL when it needs to
-- show the picture. Storing a signed URL would mean storing something that
-- stops working.
--
-- Smaller limit than meal photos. An avatar is shown at 42px; the app
-- re-encodes to at most 1280px before uploading and that lands far under
-- this, so the limit only exists to refuse something absurd.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  -- 2 MB.
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars: read own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Replacing matters here in a way it does not for meal photos: the object
-- name is fixed per user, so changing a picture is an upsert over the old one.
create policy "avatars: replace own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
