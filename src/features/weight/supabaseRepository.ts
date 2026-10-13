import type { SupabaseClient } from '@supabase/supabase-js';

import { mapPostgrestError, mapThrownError } from '@/lib/postgrest';
import { appError, err, ok, type Result } from '@/lib/result';

import type { WeightEntry, WeightRepository } from './repository';

/**
 * Supabase-backed weight storage.
 *
 * Same contract as the device store. No query filters by user id: Row Level
 * Security already restricts every row to its owner, and a client-side
 * filter would imply it was the security boundary when it is not.
 */
interface WeightRow {
  id: string;
  measured_at: string;
  weight_kg: number | string;
}

function rowToEntry(row: WeightRow): WeightEntry {
  return {
    id: row.id,
    measuredAt: row.measured_at,
    // The column is `numeric`, which PostgREST sends as a string to keep
    // the precision it promises. Parsed here rather than anywhere a chart
    // might try to do arithmetic on the text.
    weightKg: typeof row.weight_kg === 'number' ? row.weight_kg : Number(row.weight_kg),
  };
}

export function createSupabaseWeightRepository(
  client: SupabaseClient,
): WeightRepository {
  return {
    kind: 'supabase',

    async list(limit = 60): Promise<Result<WeightEntry[]>> {
      try {
        const { data, error } = await client
          .from('weight_entries')
          .select('id, measured_at, weight_kg')
          .order('measured_at', { ascending: false })
          .limit(limit);

        if (error) return err(mapPostgrestError(error, 'load your weight'));
        return ok((data ?? []).map((row) => rowToEntry(row as WeightRow)));
      } catch (cause) {
        return err(mapThrownError(cause, 'load your weight'));
      }
    },

    async add(weightKg: number, measuredAt?: string): Promise<Result<WeightEntry>> {
      try {
        const { data: auth } = await client.auth.getUser();
        const userId = auth.user?.id;
        if (userId === undefined) {
          return err(
            appError('unauthorized', 'Sign in again to save your weight.', {
              detail: 'no session when inserting a weight entry',
              retryable: false,
            }),
          );
        }

        const { data, error } = await client
          .from('weight_entries')
          .insert({
            user_id: userId,
            weight_kg: weightKg,
            measured_at: measuredAt ?? new Date().toISOString(),
          })
          .select('id, measured_at, weight_kg')
          .single();

        if (error) return err(mapPostgrestError(error, 'save your weight'));
        return ok(rowToEntry(data as WeightRow));
      } catch (cause) {
        return err(mapThrownError(cause, 'save your weight'));
      }
    },

    async remove(entryId: string): Promise<Result<void>> {
      try {
        const { error } = await client.from('weight_entries').delete().eq('id', entryId);
        if (error) return err(mapPostgrestError(error, 'remove that reading'));
        return ok(undefined);
      } catch (cause) {
        return err(mapThrownError(cause, 'remove that reading'));
      }
    },
  };
}
