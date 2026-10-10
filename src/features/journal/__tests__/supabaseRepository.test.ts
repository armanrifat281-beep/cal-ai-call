import { toDateKey } from '@/lib/date';
import { createFakeSupabase, type RecordedQuery } from '@/test/fakeSupabase';
import { EMPTY_NUTRIENTS, type FoodEntryItem } from '@/types/domain';

import { createSupabaseJournalRepository } from '../supabaseRepository';

function entryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    user_id: 'user-1',
    consumed_at: '2026-10-10T12:00:00.000Z',
    meal_type: 'lunch',
    title: 'Rice bowl',
    photo_path: null,
    notes: null,
    created_at: '2026-10-10T12:05:00.000Z',
    updated_at: '2026-10-10T12:05:00.000Z',
    food_entry_items: [
      {
        id: 'item-1',
        entry_id: 'entry-1',
        user_id: 'user-1',
        name: 'Rice',
        brand: null,
        portion_quantity: '180',
        portion_unit: 'g',
        grams_resolved: '180',
        calories_kcal: '234',
        protein_g: '4.9',
        carbs_g: '50.4',
        fat_g: '0.5',
        fiber_g: null,
        sugar_g: null,
        saturated_fat_g: null,
        sodium_mg: null,
        source: 'database',
        confidence: 'high',
        provider_label: 'USDA FoodData Central',
        provider_ref: '169704',
        food_record_id: 'usda:169704',
        notes: null,
        position: 0,
      },
    ],
    ...overrides,
  };
}

function item(overrides: Partial<FoodEntryItem> = {}): FoodEntryItem {
  return {
    id: 'client-id',
    name: 'Rice',
    brand: null,
    portion: { quantity: 180, unit: 'g' },
    gramsResolved: 180,
    nutrients: { ...EMPTY_NUTRIENTS, caloriesKcal: 234, proteinG: 5, carbsG: 50, fatG: 1 },
    provenance: {
      source: 'database',
      confidence: 'high',
      providerLabel: 'USDA FoodData Central',
      providerRef: '169704',
    },
    foodRecordId: 'usda:169704',
    notes: null,
    ...overrides,
  };
}

const POSTGREST_RLS_ERROR = {
  code: '42501',
  message: 'new row violates row-level security policy',
};

describe('identity', () => {
  it('reports itself as the supabase repository', () => {
    const fake = createFakeSupabase();
    expect(createSupabaseJournalRepository(fake.client).kind).toBe('supabase');
  });
});

describe('listEntriesForDay', () => {
  it('fetches entries with their items in one round trip', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [entryRow()] }) });
    const repo = createSupabaseJournalRepository(fake.client);

    const result = await repo.listEntriesForDay('2026-10-10');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.items).toHaveLength(1);

    expect(fake.queries).toHaveLength(1);
    const query = fake.queries[0] as RecordedQuery;
    expect(query.table).toBe('food_entries');
    expect(query.selectColumns).toBe('*, food_entry_items(*)');
  });

  it('bounds the query to the user LOCAL day, not the UTC day', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [] }) });
    const repo = createSupabaseJournalRepository(fake.client);

    await repo.listEntriesForDay('2026-10-10');

    const filters = (fake.queries[0] as RecordedQuery).filters;
    const from = filters.find(([op]) => op === 'gte')?.[2] as string;
    const to = filters.find(([op]) => op === 'lte')?.[2] as string;

    // Converted back, both bounds must land on the requested local day.
    expect(toDateKey(new Date(from))).toBe('2026-10-10');
    expect(toDateKey(new Date(to))).toBe('2026-10-10');
    // And the window must be a full day.
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(86_400_000 - 1);
  });

  it('orders newest first', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [] }) });
    await createSupabaseJournalRepository(fake.client).listEntriesForDay('2026-10-10');

    expect((fake.queries[0] as RecordedQuery).orders).toEqual([
      { column: 'consumed_at', ascending: false, nullsFirst: undefined },
    ]);
  });

  it('does NOT filter by user id: row level security is the boundary', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [] }) });
    await createSupabaseJournalRepository(fake.client).listEntriesForDay('2026-10-10');

    const columns = (fake.queries[0] as RecordedQuery).filters.map(([, column]) => column);
    expect(columns).not.toContain('user_id');
  });

  it('coerces numeric strings from the wire', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [entryRow()] }) });
    const result = await createSupabaseJournalRepository(fake.client).listEntriesForDay(
      '2026-10-10',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const nutrients = result.value[0]?.items[0]?.nutrients;
    expect(nutrients?.caloriesKcal).toBe(234);
    expect(typeof nutrients?.caloriesKcal).toBe('number');
  });

  it('returns an empty list, not an error, for a day with nothing logged', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [] }) });
    const result = await createSupabaseJournalRepository(fake.client).listEntriesForDay(
      '2026-10-10',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('maps a database error to a user-facing failure', async () => {
    const fake = createFakeSupabase({
      onQuery: () => ({ error: POSTGREST_RLS_ERROR }),
    });
    const result = await createSupabaseJournalRepository(fake.client).listEntriesForDay(
      '2026-10-10',
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unauthorized');
    expect(result.error.message).not.toContain('row-level security');
  });

  it('maps a dropped connection to a retryable network error', async () => {
    const fake = createFakeSupabase({
      onQuery: () => ({ throws: new TypeError('Network request failed') }),
    });
    const result = await createSupabaseJournalRepository(fake.client).listEntriesForDay(
      '2026-10-10',
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('network');
    expect(result.error.retryable).toBe(true);
  });
});

describe('listEntriesForRange', () => {
  it('covers the whole range inclusively, in local time', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [] }) });
    await createSupabaseJournalRepository(fake.client).listEntriesForRange(
      '2026-10-04',
      '2026-10-10',
    );

    const filters = (fake.queries[0] as RecordedQuery).filters;
    const from = new Date(String(filters.find(([op]) => op === 'gte')?.[2]));
    const to = new Date(String(filters.find(([op]) => op === 'lte')?.[2]));

    expect(toDateKey(from)).toBe('2026-10-04');
    expect(toDateKey(to)).toBe('2026-10-10');
  });
});

describe('listRecentEntries', () => {
  it('applies the requested limit', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [] }) });
    await createSupabaseJournalRepository(fake.client).listRecentEntries(4);
    expect((fake.queries[0] as RecordedQuery).limit).toBe(4);
  });

  it('clamps an absurd limit rather than asking for everything', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [] }) });
    const repo = createSupabaseJournalRepository(fake.client);

    await repo.listRecentEntries(100_000);
    expect((fake.queries[0] as RecordedQuery).limit).toBe(100);

    fake.reset();
    await repo.listRecentEntries(0);
    expect((fake.queries[0] as RecordedQuery).limit).toBe(1);
  });
});

describe('getEntry', () => {
  it('asks for a single row and returns it', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: entryRow() }) });
    const result = await createSupabaseJournalRepository(fake.client).getEntry('entry-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.title).toBe('Rice bowl');

    const query = fake.queries[0] as RecordedQuery;
    // maybeSingle, not single: a missing meal is a normal outcome.
    expect(query.single).toBe('maybe');
    expect(query.filters).toContainEqual(['eq', 'id', 'entry-1']);
  });

  it('returns null rather than an error when the meal is gone', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: null }) });
    const result = await createSupabaseJournalRepository(fake.client).getEntry('missing');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });
});

describe('createEntry', () => {
  it('writes through the transactional function, not two separate inserts', async () => {
    const fake = createFakeSupabase({
      onRpc: () => ({ data: 'new-entry-id' }),
      onQuery: () => ({ data: entryRow({ id: 'new-entry-id' }) }),
    });

    const result = await createSupabaseJournalRepository(fake.client).createEntry({
      mealType: 'lunch',
      title: 'Rice bowl',
      items: [item()],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('new-entry-id');

    expect(fake.rpcs).toHaveLength(1);
    expect(fake.rpcs[0]?.name).toBe('create_food_entry');
    // No direct insert into either table.
    expect(fake.queries.filter((q) => q.operation === 'insert')).toHaveLength(0);
  });

  it('sends items as snake_case payloads without client ids', async () => {
    const fake = createFakeSupabase({
      onRpc: () => ({ data: 'new-entry-id' }),
      onQuery: () => ({ data: entryRow() }),
    });

    await createSupabaseJournalRepository(fake.client).createEntry({
      mealType: 'dinner',
      title: 'Curry',
      items: [item({ id: 'should-not-be-sent' })],
    });

    const args = fake.rpcs[0]?.args as Record<string, unknown>;
    expect(args.p_meal_type).toBe('dinner');
    expect(args.p_title).toBe('Curry');

    const items = args.p_items as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(items[0]).not.toHaveProperty('id');
    expect(items[0]?.calories_kcal).toBe(234);
    expect(items[0]?.portion_unit).toBe('g');
  });

  it('defaults consumedAt to now when the caller omits it', async () => {
    const fake = createFakeSupabase({
      onRpc: () => ({ data: 'id' }),
      onQuery: () => ({ data: entryRow() }),
    });

    const before = Date.now();
    await createSupabaseJournalRepository(fake.client).createEntry({
      mealType: 'snack',
      title: 'Apple',
      items: [item()],
    });

    const args = fake.rpcs[0]?.args as Record<string, string> | undefined;
    const sent = new Date(String(args?.p_consumed_at)).getTime();
    expect(sent).toBeGreaterThanOrEqual(before);
    expect(sent).toBeLessThanOrEqual(Date.now());
  });

  it('refuses an empty meal locally, without a round trip', async () => {
    const fake = createFakeSupabase();
    const result = await createSupabaseJournalRepository(fake.client).createEntry({
      mealType: 'lunch',
      title: 'Nothing',
      items: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(fake.calls).toHaveLength(0);
  });

  it('surfaces a constraint rejection as a validation failure', async () => {
    const fake = createFakeSupabase({
      onRpc: () => ({
        error: { code: '23514', message: 'violates check constraint "..._calories_range"' },
      }),
    });

    const result = await createSupabaseJournalRepository(fake.client).createEntry({
      mealType: 'lunch',
      title: 'Bad numbers',
      items: [item()],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(result.error.retryable).toBe(false);
  });

  it('does not claim success when the function returns no id', async () => {
    const fake = createFakeSupabase({ onRpc: () => ({ data: null }) });
    const result = await createSupabaseJournalRepository(fake.client).createEntry({
      mealType: 'lunch',
      title: 'Odd',
      items: [item()],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('may not have saved');
  });
});

describe('updateEntry', () => {
  it('merges a partial patch onto the stored meal before replacing it', async () => {
    const fake = createFakeSupabase({
      onQuery: () => ({ data: entryRow() }),
      onRpc: () => ({ data: null }),
    });

    const result = await createSupabaseJournalRepository(fake.client).updateEntry(
      'entry-1',
      { title: 'Corrected title' },
    );

    expect(result.ok).toBe(true);

    const args = fake.rpcs[0]?.args as Record<string, unknown>;
    expect(args.p_title).toBe('Corrected title');
    // Unchanged fields come from the stored row, not from undefined.
    expect(args.p_meal_type).toBe('lunch');
    expect(args.p_consumed_at).toBe('2026-10-10T12:00:00.000Z');
    expect((args.p_items as unknown[]).length).toBe(1);
  });

  it('reports not_found when the meal is gone', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: null }) });
    const result = await createSupabaseJournalRepository(fake.client).updateEntry('gone', {
      title: 'x',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not_found');
    expect(fake.rpcs).toHaveLength(0);
  });

  it('refuses to leave a meal with no foods', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: entryRow() }) });
    const result = await createSupabaseJournalRepository(fake.client).updateEntry(
      'entry-1',
      { items: [] },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(fake.rpcs).toHaveLength(0);
  });
});

describe('deleteEntry', () => {
  it('deletes by id and asks for an exact count', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ count: 1 }) });
    const result = await createSupabaseJournalRepository(fake.client).deleteEntry('entry-1');

    expect(result.ok).toBe(true);
    const query = fake.queries[0] as RecordedQuery;
    expect(query.operation).toBe('delete');
    expect(query.countOption).toBe('exact');
    expect(query.filters).toContainEqual(['eq', 'id', 'entry-1']);
  });

  it('treats a delete that matched nothing as not_found', async () => {
    // Under RLS another user's row is invisible rather than forbidden, so a
    // zero count is the only signal that nothing was deleted.
    const fake = createFakeSupabase({ onQuery: () => ({ count: 0 }) });
    const result = await createSupabaseJournalRepository(fake.client).deleteEntry('theirs');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not_found');
  });
});

describe('duplicateEntry', () => {
  it('copies through the transactional function', async () => {
    const fake = createFakeSupabase({
      onRpc: () => ({ data: 'copy-id' }),
      onQuery: () => ({ data: entryRow({ id: 'copy-id' }) }),
    });

    const result = await createSupabaseJournalRepository(fake.client).duplicateEntry(
      'entry-1',
      { mealType: 'dinner' },
    );

    expect(result.ok).toBe(true);
    expect(fake.rpcs[0]?.name).toBe('duplicate_food_entry');
    const args = fake.rpcs[0]?.args as Record<string, unknown>;
    expect(args.p_entry_id).toBe('entry-1');
    expect(args.p_meal_type).toBe('dinner');
  });

  it('sends a null meal type when none is requested, so the original is kept', async () => {
    const fake = createFakeSupabase({
      onRpc: () => ({ data: 'copy-id' }),
      onQuery: () => ({ data: entryRow() }),
    });

    await createSupabaseJournalRepository(fake.client).duplicateEntry('entry-1', {});
    expect((fake.rpcs[0]?.args as Record<string, unknown>).p_meal_type).toBeNull();
  });
});

describe('saved meals', () => {
  const savedMealRow = {
    id: 'meal-1',
    user_id: 'user-1',
    name: 'Usual breakfast',
    meal_type: 'breakfast',
    items: [{ name: 'Oats' }],
    use_count: 3,
    last_used_at: '2026-10-09T08:00:00.000Z',
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-10-09T08:00:00.000Z',
  };

  it('lists most-used first', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [savedMealRow] }) });
    const result = await createSupabaseJournalRepository(fake.client).listSavedMeals();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.useCount).toBe(3);

    const orders = (fake.queries[0] as RecordedQuery).orders;
    expect(orders[0]).toMatchObject({ column: 'use_count', ascending: false });
  });

  it('creates a saved meal with its item snapshot', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: savedMealRow }) });
    const result = await createSupabaseJournalRepository(fake.client).createSavedMeal({
      name: '  Usual breakfast  ',
      mealType: 'breakfast',
      items: [item()],
    });

    expect(result.ok).toBe(true);
    const values = (fake.queries[0] as RecordedQuery).values as Record<string, unknown>;
    expect(values.name).toBe('Usual breakfast');
    expect(values.meal_type).toBe('breakfast');
    expect(Array.isArray(values.items)).toBe(true);
  });

  it('refuses a saved meal with no foods, without a round trip', async () => {
    const fake = createFakeSupabase();
    const result = await createSupabaseJournalRepository(fake.client).createSavedMeal({
      name: 'Empty',
      mealType: null,
      items: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(fake.calls).toHaveLength(0);
  });

  it('maps a duplicate name to a validation error', async () => {
    const fake = createFakeSupabase({
      onQuery: () => ({
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      }),
    });

    const result = await createSupabaseJournalRepository(fake.client).createSavedMeal({
      name: 'Usual breakfast',
      mealType: null,
      items: [item()],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(result.error.message).toContain('already used');
  });

  it('increments the use count and stamps the time', async () => {
    let call = 0;
    const fake = createFakeSupabase({
      onQuery: () => {
        call += 1;
        // First call reads the current count; second returns the updated row.
        return call === 1
          ? { data: { use_count: 3 } }
          : { data: { ...savedMealRow, use_count: 4 } };
      },
    });

    const result = await createSupabaseJournalRepository(fake.client).recordSavedMealUse(
      'meal-1',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.useCount).toBe(4);

    const update = fake.queries.find((q) => q.operation === 'update');
    const values = update?.values as Record<string, unknown>;
    expect(values.use_count).toBe(4);
    expect(typeof values.last_used_at).toBe('string');
  });

  it('reports not_found when the saved meal is gone', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: null }) });
    const result = await createSupabaseJournalRepository(fake.client).recordSavedMealUse(
      'gone',
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not_found');
  });

  it('treats deleting a missing saved meal as not_found', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ count: 0 }) });
    const result = await createSupabaseJournalRepository(fake.client).deleteSavedMeal('x');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not_found');
  });
});
