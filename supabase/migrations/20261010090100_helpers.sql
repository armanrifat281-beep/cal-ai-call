-- Shared helper functions and triggers.

-- Keeps `updated_at` honest without the client having to set it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
-- No search_path dependency: schema-qualify everything and pin the path so the
-- function cannot be hijacked by a schema earlier in a caller's search_path.
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger function: stamps updated_at with now() on every UPDATE.';
