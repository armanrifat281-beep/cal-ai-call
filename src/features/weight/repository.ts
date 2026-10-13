import type { Result } from '@/lib/result';

/** One weigh-in. */
export interface WeightEntry {
  id: string;
  /** ISO instant they stood on the scales. */
  measuredAt: string;
  weightKg: number;
}

/**
 * The weight data contract.
 *
 * Mirrors the journal and water: a device-only store and a Supabase-backed
 * one both implement it, so the screen never knows which is active and the
 * feature works before a backend exists.
 *
 * Deliberately no `getCurrent`. A single stored "current weight" cannot
 * answer what someone weighed a month ago, and that comparison is the only
 * reason to keep this data at all - one number today tells you nothing.
 */
export interface WeightRepository {
  readonly kind: 'local' | 'supabase';

  /** Readings newest first, most recent `limit` of them. */
  list(limit?: number): Promise<Result<WeightEntry[]>>;
  add(weightKg: number, measuredAt?: string): Promise<Result<WeightEntry>>;
  /** Takes back a reading. Undo for a mistyped number. */
  remove(entryId: string): Promise<Result<void>>;
}
