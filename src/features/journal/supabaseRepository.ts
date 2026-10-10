import type { SupabaseClient } from '@supabase/supabase-js';

import { endOfLocalDay, fromDateKey, type DateKey } from '@/lib/date';
import { appError, err, ok, type Result } from '@/lib/result';
import type { FoodEntry, SavedMeal } from '@/types/domain';

import {
  itemToPayload,
  mapPostgrestError,
  mapThrownError,
  rowToEntry,
  rowToSavedMeal,
  type FoodEntryRow,
  type SavedMealRow,
} from './mappers';
import type {
  CreateEntryInput,
  CreateSavedMealInput,
  DuplicateEntryOptions,
  JournalRepository,
  UpdateEntryPatch,
} from './repository';

/**
 * Supabase-backed journal storage.
 *
 * Implements the same contract as the device-local store, so screens do not
 * change when a user signs in.
 *
 * Two deliberate choices:
 *
 *  - Writes that touch both `food_entries` and `food_entry_items` go through
 *    database functions rather than two REST calls, so a meal cannot be half
 *    saved. See supabase/migrations/*_journal_rpcs.sql.
 *  - No query filters by user id. Row Level Security already restricts every
 *    row to its owner, and a client-side filter would imply it was the
 *    security boundary when it is not.
 */

/** Selects an entry with its foods in one round trip. */
const ENTRY_WITH_ITEMS = '*, food_entry_items(*)';

export function createSupabaseJournalRepository(
  client: SupabaseClient,
): JournalRepository {
  /**
   * The instants bounding a local calendar day.
   *
   * `consumed_at` is a timestamptz, and the user's day is a local day, so the
   * date key is converted to local midnight and the last millisecond before
   * the next one.
   */
  function dayBounds(dateKey: DateKey): { from: string; to: string } {
    const start = fromDateKey(dateKey);
    return {
      from: start.toISOString(),
      to: endOfLocalDay(start).toISOString(),
    };
  }

  async function fetchEntries(
    build: (
      query: ReturnType<ReturnType<SupabaseClient['from']>['select']>,
    ) => unknown,
    context: string,
  ): Promise<Result<FoodEntry[]>> {
    try {
      const query = client.from('food_entries').select(ENTRY_WITH_ITEMS);
      const { data, error } = (await build(query)) as {
        data: FoodEntryRow[] | null;
        error: Parameters<typeof mapPostgrestError>[0] | null;
      };

      if (error) return err(mapPostgrestError(error, context));
      return ok((data ?? []).map(rowToEntry));
    } catch (cause) {
      return err(mapThrownError(cause, context));
    }
  }

  return {
    kind: 'supabase',

    async listEntriesForDay(dateKey) {
      const { from, to } = dayBounds(dateKey);
      return fetchEntries(
        (query) =>
          query
            .gte('consumed_at', from)
            .lte('consumed_at', to)
            .order('consumed_at', { ascending: false }),
        'listEntriesForDay',
      );
    },

    async listEntriesForRange(startKey, endKey) {
      const from = fromDateKey(startKey).toISOString();
      const to = endOfLocalDay(fromDateKey(endKey)).toISOString();
      return fetchEntries(
        (query) =>
          query
            .gte('consumed_at', from)
            .lte('consumed_at', to)
            .order('consumed_at', { ascending: false }),
        'listEntriesForRange',
      );
    },

    async listRecentEntries(limit) {
      return fetchEntries(
        (query) =>
          query
            .order('consumed_at', { ascending: false })
            .limit(Math.max(1, Math.min(limit, 100))),
        'listRecentEntries',
      );
    },

    async getEntry(entryId): Promise<Result<FoodEntry | null>> {
      try {
        const { data, error } = await client
          .from('food_entries')
          .select(ENTRY_WITH_ITEMS)
          .eq('id', entryId)
          // maybeSingle, not single: a missing row is a normal outcome here,
          // not an error.
          .maybeSingle();

        if (error) return err(mapPostgrestError(error, 'getEntry'));
        return ok(data ? rowToEntry(data as FoodEntryRow) : null);
      } catch (cause) {
        return err(mapThrownError(cause, 'getEntry'));
      }
    },

    async createEntry(input: CreateEntryInput): Promise<Result<FoodEntry>> {
      if (input.items.length === 0) {
        return err(
          appError('validation', 'Add at least one food to save this meal.', {
            retryable: false,
          }),
        );
      }

      try {
        const { data, error } = await client.rpc('create_food_entry', {
          p_meal_type: input.mealType,
          p_title: input.title,
          p_items: input.items.map(itemToPayload),
          p_consumed_at: input.consumedAt ?? new Date().toISOString(),
          p_photo_path: input.photoPath ?? null,
          p_notes: input.notes ?? null,
        });

        if (error) return err(mapPostgrestError(error, 'createEntry'));

        const newId = typeof data === 'string' ? data : null;
        if (!newId) {
          return err(
            appError('unknown', 'The meal may not have saved. Check your journal.', {
              detail: `create_food_entry returned ${JSON.stringify(data)}`,
            }),
          );
        }

        return readBack(newId, 'createEntry');
      } catch (cause) {
        return err(mapThrownError(cause, 'createEntry'));
      }
    },

    async updateEntry(
      entryId,
      patch: UpdateEntryPatch,
    ): Promise<Result<FoodEntry>> {
      // The function replaces the whole meal, so a partial patch is merged
      // onto the stored row first. That costs a read, and it keeps the caller
      // free to send only what changed.
      const existing = await this.getEntry(entryId);
      if (!existing.ok) return existing;
      if (!existing.value) {
        return err(
          appError('not_found', 'That meal is no longer in your journal.', {
            retryable: false,
          }),
        );
      }

      const merged = { ...existing.value, ...patch };
      if (merged.items.length === 0) {
        return err(
          appError('validation', 'A meal needs at least one food.', {
            retryable: false,
          }),
        );
      }

      try {
        const { error } = await client.rpc('update_food_entry', {
          p_entry_id: entryId,
          p_meal_type: merged.mealType,
          p_title: merged.title,
          p_items: merged.items.map(itemToPayload),
          p_consumed_at: merged.consumedAt,
          p_photo_path: merged.photoPath,
          p_notes: merged.notes,
        });

        if (error) return err(mapPostgrestError(error, 'updateEntry'));
        return readBack(entryId, 'updateEntry');
      } catch (cause) {
        return err(mapThrownError(cause, 'updateEntry'));
      }
    },

    async deleteEntry(entryId): Promise<Result<void>> {
      try {
        const { error, count } = await client
          .from('food_entries')
          .delete({ count: 'exact' })
          .eq('id', entryId);

        if (error) return err(mapPostgrestError(error, 'deleteEntry'));

        // Row Level Security makes another user's row invisible rather than
        // erroring, so a delete that matched nothing means "not yours or not
        // there" - both of which the user should be told about.
        if (count === 0) {
          return err(
            appError('not_found', 'That meal is no longer in your journal.', {
              retryable: false,
            }),
          );
        }

        return ok(undefined);
      } catch (cause) {
        return err(mapThrownError(cause, 'deleteEntry'));
      }
    },

    async duplicateEntry(
      entryId,
      options: DuplicateEntryOptions,
    ): Promise<Result<FoodEntry>> {
      try {
        const { data, error } = await client.rpc('duplicate_food_entry', {
          p_entry_id: entryId,
          p_consumed_at: options.consumedAt ?? new Date().toISOString(),
          p_meal_type: options.mealType ?? null,
        });

        if (error) return err(mapPostgrestError(error, 'duplicateEntry'));

        const newId = typeof data === 'string' ? data : null;
        if (!newId) {
          return err(
            appError('unknown', 'The copy may not have saved. Check your journal.', {
              detail: `duplicate_food_entry returned ${JSON.stringify(data)}`,
            }),
          );
        }

        return readBack(newId, 'duplicateEntry');
      } catch (cause) {
        return err(mapThrownError(cause, 'duplicateEntry'));
      }
    },

    async listSavedMeals(): Promise<Result<SavedMeal[]>> {
      try {
        const { data, error } = await client
          .from('saved_meals')
          .select('*')
          .order('use_count', { ascending: false })
          .order('last_used_at', { ascending: false, nullsFirst: false });

        if (error) return err(mapPostgrestError(error, 'listSavedMeals'));
        return ok(((data ?? []) as SavedMealRow[]).map(rowToSavedMeal));
      } catch (cause) {
        return err(mapThrownError(cause, 'listSavedMeals'));
      }
    },

    async createSavedMeal(
      input: CreateSavedMealInput,
    ): Promise<Result<SavedMeal>> {
      if (input.items.length === 0) {
        return err(
          appError('validation', 'A saved meal needs at least one food.', {
            retryable: false,
          }),
        );
      }

      try {
        const { data, error } = await client
          .from('saved_meals')
          .insert({
            name: input.name.trim(),
            meal_type: input.mealType,
            // Stored as a JSON snapshot so the template keeps the numbers it
            // had even if the original journal entry is later changed.
            items: input.items,
          })
          .select('*')
          .single();

        if (error) return err(mapPostgrestError(error, 'createSavedMeal'));
        return ok(rowToSavedMeal(data as SavedMealRow));
      } catch (cause) {
        return err(mapThrownError(cause, 'createSavedMeal'));
      }
    },

    async deleteSavedMeal(savedMealId): Promise<Result<void>> {
      try {
        const { error, count } = await client
          .from('saved_meals')
          .delete({ count: 'exact' })
          .eq('id', savedMealId);

        if (error) return err(mapPostgrestError(error, 'deleteSavedMeal'));
        if (count === 0) {
          return err(
            appError('not_found', 'That saved meal no longer exists.', {
              retryable: false,
            }),
          );
        }
        return ok(undefined);
      } catch (cause) {
        return err(mapThrownError(cause, 'deleteSavedMeal'));
      }
    },

    async recordSavedMealUse(savedMealId): Promise<Result<SavedMeal>> {
      try {
        // Read-then-write: the count could drift if the same meal were logged
        // from two devices at once, which is not worth a database function.
        const { data: current, error: readError } = await client
          .from('saved_meals')
          .select('use_count')
          .eq('id', savedMealId)
          .maybeSingle();

        if (readError) {
          return err(mapPostgrestError(readError, 'recordSavedMealUse'));
        }
        if (!current) {
          return err(
            appError('not_found', 'That saved meal no longer exists.', {
              retryable: false,
            }),
          );
        }

        const nextCount =
          (typeof current.use_count === 'number'
            ? current.use_count
            : Number.parseInt(String(current.use_count), 10) || 0) + 1;

        const { data, error } = await client
          .from('saved_meals')
          .update({ use_count: nextCount, last_used_at: new Date().toISOString() })
          .eq('id', savedMealId)
          .select('*')
          .single();

        if (error) return err(mapPostgrestError(error, 'recordSavedMealUse'));
        return ok(rowToSavedMeal(data as SavedMealRow));
      } catch (cause) {
        return err(mapThrownError(cause, 'recordSavedMealUse'));
      }
    },
  };

  /**
   * Re-reads an entry after a write.
   *
   * The functions return only an id, and the caller wants the saved row with
   * its database-generated ids and timestamps.
   */
  async function readBack(
    entryId: string,
    context: string,
  ): Promise<Result<FoodEntry>> {
    try {
      const { data, error } = await client
        .from('food_entries')
        .select(ENTRY_WITH_ITEMS)
        .eq('id', entryId)
        .maybeSingle();

      if (error) return err(mapPostgrestError(error, context));
      if (!data) {
        return err(
          appError('unknown', 'The meal saved but could not be read back.', {
            detail: `${context}: entry ${entryId} not readable after write`,
          }),
        );
      }
      return ok(rowToEntry(data as FoodEntryRow));
    } catch (cause) {
      return err(mapThrownError(cause, context));
    }
  }
}
