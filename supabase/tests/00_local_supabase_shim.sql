-- Local-only shim emulating the parts of Supabase our migrations depend on.
--
-- This file is NEVER applied to a real Supabase project: there, `auth` and
-- `storage` already exist and are managed by the platform. It exists so the
-- migrations and, more importantly, the Row Level Security policies can be
-- applied and exercised against a throwaway Postgres instance in CI.
--
-- `auth.uid()` is reproduced exactly as Supabase defines it: it reads the `sub`
-- claim out of the `request.jwt.claims` setting. Tests set that setting to
-- impersonate a user, which is how a real request behaves.

create extension if not exists pgcrypto;

create schema if not exists auth;
create schema if not exists storage;

-- The roles PostgREST assumes for anonymous and signed-in requests.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  -- The empty-string guard runs BEFORE the json cast: an anonymous request has
  -- no claims, and '' is not valid json.
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub',
    ''
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(
      nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
      ''
    ),
    'anon'
  );
$$;

-- Minimal stand-ins for the storage tables our policies attach to.
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now(),
  metadata jsonb
);

alter table storage.objects enable row level security;

-- Supabase's helper: splits an object path into its folder components.
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  -- Everything except the final element (the file name itself).
  return parts[1 : array_length(parts, 1) - 1];
end;
$$;

-- Grants Supabase applies to the API schemas. Table privileges are what let a
-- request reach a table at all; RLS then decides which ROWS it may touch. Both
-- layers have to be present for the policy tests to be meaningful.
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects
  to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
