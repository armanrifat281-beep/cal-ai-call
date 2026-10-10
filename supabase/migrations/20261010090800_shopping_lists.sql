-- Shopping lists.
--
-- A list holds items; an item may come from a saved recipe, in which case it
-- keeps a reference so the user can see why it is on the list. Deleting the
-- recipe does not delete the item: you still need the onion.

create type public.shopping_list_status as enum ('active', 'archived');

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  name text not null,
  status public.shopping_list_status not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shopping_lists_name_length check (char_length(name) between 1 and 160)
);

comment on table public.shopping_lists is
  'A shopping list. Items live in shopping_list_items.';

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,

  -- Denormalized owner, same pattern and guarantees as food_entry_items: it
  -- keeps each policy to one indexed comparison, and a trigger forces it to
  -- match the parent list.
  user_id uuid not null references auth.users (id) on delete cascade,

  name text not null,
  -- Quantity and unit are both optional: "bread" is a perfectly good entry.
  quantity numeric(10, 3),
  unit public.portion_unit,
  -- Aisle or grouping, e.g. "Produce". Free text because supermarkets differ.
  category text,

  is_checked boolean not null default false,
  note text,
  position integer not null default 0,

  -- Which recipe put this on the list, if any. ON DELETE SET NULL: removing
  -- the recipe must not silently remove something you still need to buy.
  source_recipe_id uuid references public.saved_recipes (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shopping_list_items_name_length check (char_length(name) between 1 and 200),
  constraint shopping_list_items_note_length
    check (note is null or char_length(note) <= 500),
  constraint shopping_list_items_category_length
    check (category is null or char_length(category) <= 80),
  constraint shopping_list_items_quantity_positive
    check (quantity is null or (quantity > 0 and quantity <= 100000)),
  -- A unit with no quantity ("g of flour") is meaningless.
  constraint shopping_list_items_unit_requires_quantity
    check (unit is null or quantity is not null),
  constraint shopping_list_items_position_range check (position between 0 and 10000)
);

comment on table public.shopping_list_items is
  'One line on a shopping list. Quantity and unit are optional.';
comment on column public.shopping_list_items.source_recipe_id is
  'Set null on recipe delete: you still need the ingredient.';

-- Forces shopping_list_items.user_id to the parent list's owner, so the
-- denormalized column can never disagree with the list it belongs to.
create or replace function public.sync_shopping_list_item_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_user_id uuid;
begin
  select user_id into parent_user_id
  from public.shopping_lists
  where id = new.list_id;

  if parent_user_id is null then
    raise exception 'shopping_list_items.list_id % does not exist', new.list_id
      using errcode = 'foreign_key_violation';
  end if;

  new.user_id := parent_user_id;
  return new;
end;
$$;

comment on function public.sync_shopping_list_item_owner is
  'Sets shopping_list_items.user_id from its parent list, so it cannot diverge.';

create trigger shopping_list_items_sync_owner
  before insert or update of list_id, user_id on public.shopping_list_items
  for each row execute function public.sync_shopping_list_item_owner();

create trigger shopping_lists_set_updated_at
  before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create trigger shopping_list_items_set_updated_at
  before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

create index shopping_lists_user_status_idx
  on public.shopping_lists (user_id, status, updated_at desc);

create index shopping_list_items_list_idx
  on public.shopping_list_items (list_id, position);

create index shopping_list_items_user_id_idx
  on public.shopping_list_items (user_id);

-- "What is still unchecked on this list?"
create index shopping_list_items_outstanding_idx
  on public.shopping_list_items (list_id, position)
  where not is_checked;

alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

create policy "shopping_lists: read own"
  on public.shopping_lists for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "shopping_lists: insert own"
  on public.shopping_lists for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "shopping_lists: update own"
  on public.shopping_lists for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "shopping_lists: delete own"
  on public.shopping_lists for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- As with food_entry_items, writes are checked against the parent list
-- directly as well as against the denormalized owner.
create policy "shopping_list_items: read own"
  on public.shopping_list_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "shopping_list_items: insert into own list"
  on public.shopping_list_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.shopping_lists l
      where l.id = list_id
        and l.user_id = (select auth.uid())
    )
  );

create policy "shopping_list_items: update own"
  on public.shopping_list_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    exists (
      select 1
      from public.shopping_lists l
      where l.id = list_id
        and l.user_id = (select auth.uid())
    )
  );

create policy "shopping_list_items: delete own"
  on public.shopping_list_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);
