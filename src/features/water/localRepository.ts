import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  endOfLocalDay,
  fromDateKey,
  startOfLocalDay,
  type DateKey,
} from '@/lib/date';
import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';

import type { WaterEntry, WaterRepository } from './repository';

/**
 * Device-only water storage.
 *
 * Works with no account at all, exactly like the device journal, so the
 * feature is real before a backend is configured rather than a button that
 * explains itself.
 */
const STORAGE_KEY = 'foodlens.water.v1';

/** Keeps device storage bounded. Roughly a year of ordinary drinking. */
const MAX_ENTRIES = 4000;

/**
 * Serializes read-modify-write cycles.
 *
 * AsyncStorage has no transactions, so two taps in the same moment could
 * each read the old list and the second would overwrite the first - which,
 * on a button people tap repeatedly, is not a theoretical race.
 */
let writeChain: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const run = writeChain.then(operation, operation);
  writeChain = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<WaterEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WaterEntry[]) : [];
  } catch (cause) {
    logger.warn('local water: unreadable stored value, starting fresh', {
      cause: String(cause),
    });
    return [];
  }
}

function storageError(cause: unknown) {
  return appError('unknown', 'Could not save to this device. Free up space and try again.', {
    detail: String(cause),
    retryable: true,
  });
}

function newestFirst(a: WaterEntry, b: WaterEntry): number {
  return b.consumedAt.localeCompare(a.consumedAt);
}

export function createLocalWaterRepository(): WaterRepository {
  return {
    kind: 'local',

    async listForDay(dateKey: DateKey): Promise<Result<WaterEntry[]>> {
      const all = await readAll();
      const day = fromDateKey(dateKey);
      // Compared as instants, not as date strings: a drink at 23:50 is on
      // the day the user was awake for, whatever UTC thinks.
      const from = startOfLocalDay(day).getTime();
      const to = endOfLocalDay(day).getTime();

      return ok(
        all
          .filter((entry) => {
            const at = new Date(entry.consumedAt).getTime();
            return at >= from && at <= to;
          })
          .sort(newestFirst),
      );
    },

    async add(amountMl: number, consumedAt?: string): Promise<Result<WaterEntry>> {
      const entry: WaterEntry = {
        id: `water-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        consumedAt: consumedAt ?? new Date().toISOString(),
        amountMl,
      };

      try {
        await serialize(async () => {
          const all = await readAll();
          const next = [entry, ...all].sort(newestFirst).slice(0, MAX_ENTRIES);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        });
        return ok(entry);
      } catch (cause) {
        return err(storageError(cause));
      }
    },

    async remove(entryId: string): Promise<Result<void>> {
      try {
        await serialize(async () => {
          const all = await readAll();
          const next = all.filter((entry) => entry.id !== entryId);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        });
        return ok(undefined);
      } catch (cause) {
        return err(storageError(cause));
      }
    },
  };
}

/** Clears stored water. Used by sign-out and account deletion. */
export async function clearLocalWater(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
