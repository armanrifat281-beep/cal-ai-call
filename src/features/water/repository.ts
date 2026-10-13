import type { DateKey } from '@/lib/date';
import type { Result } from '@/lib/result';

/** One drink. */
export interface WaterEntry {
  id: string;
  /** ISO instant it was drunk. */
  consumedAt: string;
  amountMl: number;
}

/**
 * The water data contract.
 *
 * Mirrors the journal: a device-only store and a Supabase-backed one both
 * implement this, so the screen never knows which is active and the feature
 * works before a backend exists.
 *
 * Deliberately no `setTotal`. A running total is one mutable number that two
 * devices can clobber, and it cannot answer "I tapped that by mistake".
 * Drinks are rows; the total is a sum.
 */
export interface WaterRepository {
  readonly kind: 'local' | 'supabase';

  /** Every drink on one local day, newest first. */
  listForDay(dateKey: DateKey): Promise<Result<WaterEntry[]>>;
  add(amountMl: number, consumedAt?: string): Promise<Result<WaterEntry>>;
  /** Takes back a drink. Undo for a mis-tap. */
  remove(entryId: string): Promise<Result<void>>;
}
