import type { SupabaseClient } from '@supabase/supabase-js';

import { endOfLocalDay, fromDateKey, startOfLocalDay, type DateKey } from '@/lib/date';
import { mapPostgrestError, mapThrownError } from '@/lib/postgrest';
import { appError, err, ok, type Result } from '@/lib/result';

import type { WaterEntry, WaterRepository } from './repository';

/**
 * Supabase-backed water storage.
 *
 * Same contract as the device store, so the screen does not change when a
 * user signs in.
 *
 * No query filters by user id. Row Level Security already restricts every
 * row to its owner, and a client-side filter would imply it was the security
 * boundary when it is not. `user_id` is set on insert only because the
 * column is NOT NULL; the policy is what makes it the right one.
 */
interface WaterRow {
  id: string;
  consumed_at: string;
  amount_ml: number;
}

function rowToEntry(row: WaterRow): WaterEntry {
  return {
    id: row.id,
    consumedAt: row.consumed_at,
    amountMl: row.amount_ml,
  };
}

export function createSupabaseWaterRepository(
  client: SupabaseClient,
): WaterRepository {
  return {
    kind: 'supabase',

    async listForDay(dateKey: DateKey): Promise<Result<WaterEntry[]>> {
      try {
        const day = fromDateKey(dateKey);
        const { data, error } = await client
          .from('water_entries')
          .select('id, consumed_at, amount_ml')
          // Bounded by local-day instants, so a drink at 23:50 lands on the
          // day the user was awake for rather than on UTC's idea of it.
          .gte('consumed_at', startOfLocalDay(day).toISOString())
          .lte('consumed_at', endOfLocalDay(day).toISOString())
          .order('consumed_at', { ascending: false });

        if (error) return err(mapPostgrestError(error, 'load your water'));
        return ok((data ?? []).map((row) => rowToEntry(row as WaterRow)));
      } catch (cause) {
        return err(mapThrownError(cause, 'load your water'));
      }
    },

    async add(amountMl: number, consumedAt?: string): Promise<Result<WaterEntry>> {
      try {
        const { data: auth } = await client.auth.getUser();
        const userId = auth.user?.id;
        if (userId === undefined) {
          // Not a database failure: the row needs an owner and there is no
          // session to take one from.
          return err(
            appError('unauthorized', 'Sign in again to save your water.', {
              detail: 'no session when inserting a water entry',
              retryable: false,
            }),
          );
        }

        const { data, error } = await client
          .from('water_entries')
          .insert({
            user_id: userId,
            amount_ml: amountMl,
            consumed_at: consumedAt ?? new Date().toISOString(),
          })
          .select('id, consumed_at, amount_ml')
          .single();

        if (error) return err(mapPostgrestError(error, 'save your water'));
        return ok(rowToEntry(data as WaterRow));
      } catch (cause) {
        return err(mapThrownError(cause, 'save your water'));
      }
    },

    async remove(entryId: string): Promise<Result<void>> {
      try {
        const { error } = await client
          .from('water_entries')
          .delete()
          .eq('id', entryId);

        if (error) return err(mapPostgrestError(error, 'remove that drink'));
        return ok(undefined);
      } catch (cause) {
        return err(mapThrownError(cause, 'remove that drink'));
      }
    },
  };
}
