import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';

import type { WeightEntry, WeightRepository } from './repository';

/**
 * Device-only weight storage.
 *
 * Works with no account at all, exactly like the device journal, so the
 * feature is real before a backend is configured rather than a button that
 * explains itself.
 */
const STORAGE_KEY = 'foodlens.weight.v1';

/** Keeps device storage bounded. Years of daily weigh-ins. */
const MAX_ENTRIES = 2000;

/**
 * Serializes read-modify-write cycles.
 *
 * AsyncStorage has no transactions, so two saves in the same moment could
 * each read the old list and the second would overwrite the first.
 */
let writeChain: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const run = writeChain.then(operation, operation);
  writeChain = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<WeightEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WeightEntry[]) : [];
  } catch (cause) {
    logger.warn('local weight: unreadable stored value, starting fresh', {
      cause: String(cause),
    });
    return [];
  }
}

function newestFirst(a: WeightEntry, b: WeightEntry): number {
  return b.measuredAt.localeCompare(a.measuredAt);
}

function storageError(cause: unknown) {
  return appError('unknown', 'Could not save to this device. Free up space and try again.', {
    detail: String(cause),
    retryable: true,
  });
}

export function createLocalWeightRepository(): WeightRepository {
  return {
    kind: 'local',

    async list(limit = 60): Promise<Result<WeightEntry[]>> {
      const all = await readAll();
      return ok([...all].sort(newestFirst).slice(0, limit));
    },

    async add(weightKg: number, measuredAt?: string): Promise<Result<WeightEntry>> {
      const entry: WeightEntry = {
        id: `weight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        measuredAt: measuredAt ?? new Date().toISOString(),
        weightKg,
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
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(all.filter((entry) => entry.id !== entryId)),
          );
        });
        return ok(undefined);
      } catch (cause) {
        return err(storageError(cause));
      }
    },
  };
}

/** Clears stored weight. Used by sign-out and account deletion. */
export async function clearLocalWeight(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
