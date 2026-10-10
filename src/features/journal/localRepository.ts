import AsyncStorage from '@react-native-async-storage/async-storage';

import { toDateKey, type DateKey } from '@/lib/date';
import { newId } from '@/lib/id';
import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';
import type { FoodEntry, SavedMeal } from '@/types/domain';

import type {
  CreateEntryInput,
  CreateSavedMealInput,
  DuplicateEntryOptions,
  JournalRepository,
  UpdateEntryPatch,
} from './repository';

/**
 * Device-only journal storage.
 *
 * This is what powers the app before an account exists, and it is real
 * persistence rather than mock data: entries survive app restarts. It has two
 * deliberate limits, which the UI states plainly:
 *
 *  - data lives only on this device and is lost if the app is deleted;
 *  - there is a cap on stored entries, so it is not an archive.
 *
 * The user id is the sentinel below, because no account exists yet. When the
 * user signs in, the migration step re-owns these rows to their real id.
 */

const ENTRIES_KEY = 'foodlens.journal.entries.v1';
const SAVED_MEALS_KEY = 'foodlens.journal.saved-meals.v1';

/** Owner id used for rows created before sign-in. */
export const LOCAL_USER_ID = 'local-device';

/** Keeps device storage bounded. Oldest entries beyond this are dropped. */
export const LOCAL_ENTRY_LIMIT = 500;

/**
 * Serializes read-modify-write cycles.
 *
 * AsyncStorage has no transactions, so two concurrent saves could each read the
 * old list and the second would overwrite the first. Chaining every mutation
 * through one promise removes that race.
 */
let writeChain: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const run = writeChain.then(operation, operation);
  // Swallow rejection on the chain itself so one failure cannot poison the next.
  writeChain = run.catch(() => undefined);
  return run;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch (cause) {
    logger.warn('local journal: unreadable stored value, starting fresh', { key, cause: String(cause) });
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function byConsumedAtDesc(a: FoodEntry, b: FoodEntry): number {
  return b.consumedAt.localeCompare(a.consumedAt);
}

function storageError(cause: unknown) {
  return appError('unknown', 'Could not save to this device. Free up space and try again.', {
    detail: String(cause),
    retryable: true,
  });
}

export function createLocalJournalRepository(): JournalRepository {
  async function allEntries(): Promise<FoodEntry[]> {
    return readJson<FoodEntry[]>(ENTRIES_KEY, []);
  }

  async function allSavedMeals(): Promise<SavedMeal[]> {
    return readJson<SavedMeal[]>(SAVED_MEALS_KEY, []);
  }

  return {
    kind: 'local',

    async listEntriesForDay(dateKey: DateKey): Promise<Result<FoodEntry[]>> {
      try {
        const entries = await allEntries();
        return ok(
          entries
            .filter((entry) => toDateKey(new Date(entry.consumedAt)) === dateKey)
            .sort(byConsumedAtDesc),
        );
      } catch (cause) {
        return err(storageError(cause));
      }
    },

    async listEntriesForRange(startKey, endKey): Promise<Result<FoodEntry[]>> {
      try {
        const entries = await allEntries();
        return ok(
          entries
            .filter((entry) => {
              const key = toDateKey(new Date(entry.consumedAt));
              return key >= startKey && key <= endKey;
            })
            .sort(byConsumedAtDesc),
        );
      } catch (cause) {
        return err(storageError(cause));
      }
    },

    async getEntry(entryId): Promise<Result<FoodEntry | null>> {
      try {
        const entries = await allEntries();
        return ok(entries.find((entry) => entry.id === entryId) ?? null);
      } catch (cause) {
        return err(storageError(cause));
      }
    },

    async listRecentEntries(limit): Promise<Result<FoodEntry[]>> {
      try {
        const entries = await allEntries();
        return ok(entries.sort(byConsumedAtDesc).slice(0, Math.max(0, limit)));
      } catch (cause) {
        return err(storageError(cause));
      }
    },

    createEntry(input: CreateEntryInput): Promise<Result<FoodEntry>> {
      return serialize(async () => {
        try {
          const now = new Date().toISOString();
          const entry: FoodEntry = {
            id: newId(),
            userId: LOCAL_USER_ID,
            consumedAt: input.consumedAt ?? now,
            mealType: input.mealType,
            title: input.title,
            items: input.items,
            photoPath: input.photoPath ?? null,
            notes: input.notes ?? null,
            createdAt: now,
            updatedAt: now,
          };

          const entries = await allEntries();
          const next = [entry, ...entries]
            .sort(byConsumedAtDesc)
            .slice(0, LOCAL_ENTRY_LIMIT);
          await writeJson(ENTRIES_KEY, next);
          return ok(entry);
        } catch (cause) {
          return err(storageError(cause));
        }
      });
    },

    updateEntry(entryId, patch: UpdateEntryPatch): Promise<Result<FoodEntry>> {
      return serialize(async () => {
        try {
          const entries = await allEntries();
          const index = entries.findIndex((entry) => entry.id === entryId);
          const existing = entries[index];
          if (index < 0 || !existing) {
            return err(appError('not_found', 'That meal is no longer in your journal.'));
          }

          const updated: FoodEntry = {
            ...existing,
            ...patch,
            // Never let a patch rewrite ownership or creation metadata.
            id: existing.id,
            userId: existing.userId,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
          };

          const next = [...entries];
          next[index] = updated;
          await writeJson(ENTRIES_KEY, next.sort(byConsumedAtDesc));
          return ok(updated);
        } catch (cause) {
          return err(storageError(cause));
        }
      });
    },

    deleteEntry(entryId): Promise<Result<void>> {
      return serialize(async () => {
        try {
          const entries = await allEntries();
          const next = entries.filter((entry) => entry.id !== entryId);
          if (next.length === entries.length) {
            return err(appError('not_found', 'That meal is no longer in your journal.'));
          }
          await writeJson(ENTRIES_KEY, next);
          return ok(undefined);
        } catch (cause) {
          return err(storageError(cause));
        }
      });
    },

    duplicateEntry(entryId, options: DuplicateEntryOptions): Promise<Result<FoodEntry>> {
      return serialize(async () => {
        try {
          const entries = await allEntries();
          const source = entries.find((entry) => entry.id === entryId);
          if (!source) {
            return err(appError('not_found', 'That meal is no longer in your journal.'));
          }

          const now = new Date().toISOString();
          const copy: FoodEntry = {
            ...source,
            id: newId(),
            consumedAt: options.consumedAt ?? now,
            mealType: options.mealType ?? source.mealType,
            // Give the copy fresh item ids so edits never affect the original.
            items: source.items.map((item) => ({ ...item, id: newId() })),
            // The photo belongs to the original analysis, not to this copy.
            photoPath: null,
            createdAt: now,
            updatedAt: now,
          };

          const next = [copy, ...entries].sort(byConsumedAtDesc).slice(0, LOCAL_ENTRY_LIMIT);
          await writeJson(ENTRIES_KEY, next);
          return ok(copy);
        } catch (cause) {
          return err(storageError(cause));
        }
      });
    },

    async listSavedMeals(): Promise<Result<SavedMeal[]>> {
      try {
        const meals = await allSavedMeals();
        return ok(
          meals.sort((a, b) => {
            if (b.useCount !== a.useCount) return b.useCount - a.useCount;
            return (b.lastUsedAt ?? b.createdAt).localeCompare(a.lastUsedAt ?? a.createdAt);
          }),
        );
      } catch (cause) {
        return err(storageError(cause));
      }
    },

    createSavedMeal(input: CreateSavedMealInput): Promise<Result<SavedMeal>> {
      return serialize(async () => {
        try {
          const now = new Date().toISOString();
          const meal: SavedMeal = {
            id: newId(),
            userId: LOCAL_USER_ID,
            name: input.name,
            mealType: input.mealType,
            items: input.items,
            useCount: 0,
            lastUsedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          const meals = await allSavedMeals();
          await writeJson(SAVED_MEALS_KEY, [meal, ...meals]);
          return ok(meal);
        } catch (cause) {
          return err(storageError(cause));
        }
      });
    },

    deleteSavedMeal(savedMealId): Promise<Result<void>> {
      return serialize(async () => {
        try {
          const meals = await allSavedMeals();
          const next = meals.filter((meal) => meal.id !== savedMealId);
          if (next.length === meals.length) {
            return err(appError('not_found', 'That saved meal no longer exists.'));
          }
          await writeJson(SAVED_MEALS_KEY, next);
          return ok(undefined);
        } catch (cause) {
          return err(storageError(cause));
        }
      });
    },

    recordSavedMealUse(savedMealId): Promise<Result<SavedMeal>> {
      return serialize(async () => {
        try {
          const meals = await allSavedMeals();
          const index = meals.findIndex((meal) => meal.id === savedMealId);
          const existing = meals[index];
          if (index < 0 || !existing) {
            return err(appError('not_found', 'That saved meal no longer exists.'));
          }
          const now = new Date().toISOString();
          const updated: SavedMeal = {
            ...existing,
            useCount: existing.useCount + 1,
            lastUsedAt: now,
            updatedAt: now,
          };
          const next = [...meals];
          next[index] = updated;
          await writeJson(SAVED_MEALS_KEY, next);
          return ok(updated);
        } catch (cause) {
          return err(storageError(cause));
        }
      });
    },
  };
}

/** Removes every locally stored journal row. Used by "clear local data". */
export async function clearLocalJournal(): Promise<void> {
  await AsyncStorage.multiRemove([ENTRIES_KEY, SAVED_MEALS_KEY]);
}
