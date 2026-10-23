import { useSyncExternalStore } from 'react';

import type { Result } from '@/lib/result';

import type {
  CreateEntryInput,
  CreateSavedMealInput,
  DuplicateEntryOptions,
  JournalRepository,
  UpdateEntryPatch,
} from './repository';

/**
 * A counter that changes whenever anything in the journal is written.
 *
 * The reason this exists: the tabs stay mounted. Saving a scan and then
 * tapping Home showed the ring at zero and "Nothing logged yet" over a meal
 * that was already in the database, because home had read the day once when
 * it mounted and nothing ever told it to read again. Pull-to-refresh fixed
 * it, which is no use to someone who has no reason to suspect the screen is
 * lying to them.
 *
 * Every read hook depends on this number, and every successful write bumps
 * it, so a save anywhere re-reads everything showing that data - whether the
 * screen that wrote it is the one displaying it or not.
 *
 * Deliberately not a timestamp or a per-day key: the cost of re-reading a
 * week is one small query, and anything finer-grained is a cache invalidation
 * problem, which is the kind of cleverness that produces exactly the bug
 * above.
 */

let revision = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getRevision(): number {
  return revision;
}

/** Tells every mounted read hook that the journal changed. */
export function bumpJournalRevision(): void {
  revision += 1;
  listeners.forEach((listener) => listener());
}

/** Resets the counter. Tests only, so one test's writes cannot leak. */
export function resetJournalRevision(): void {
  revision = 0;
  listeners.clear();
}

/**
 * The current revision. Put it in a read's dependency list and the read
 * re-runs after any write.
 */
export function useJournalRevision(): number {
  return useSyncExternalStore(subscribe, getRevision, getRevision);
}

/** Bumps on success only: a failed write changed nothing to re-read. */
async function tracked<T>(promise: Promise<Result<T>>): Promise<Result<T>> {
  const result = await promise;
  if (result.ok) bumpJournalRevision();
  return result;
}

/**
 * The same repository, with every write announcing itself.
 *
 * Wrapping here rather than asking each screen to report its own writes:
 * there are a dozen places that save something and only one that must not be
 * forgotten, and "remember to call reload" is the instruction that produced
 * the stale home screen in the first place.
 */
export function trackJournalWrites(repository: JournalRepository): JournalRepository {
  return {
    kind: repository.kind,

    // Reads pass straight through.
    listEntriesForDay: (dateKey) => repository.listEntriesForDay(dateKey),
    listEntriesForRange: (startKey, endKey) =>
      repository.listEntriesForRange(startKey, endKey),
    getEntry: (entryId) => repository.getEntry(entryId),
    listRecentEntries: (limit) => repository.listRecentEntries(limit),
    listSavedMeals: () => repository.listSavedMeals(),

    createEntry: (input: CreateEntryInput) => tracked(repository.createEntry(input)),
    updateEntry: (entryId: string, patch: UpdateEntryPatch) =>
      tracked(repository.updateEntry(entryId, patch)),
    deleteEntry: (entryId: string) => tracked(repository.deleteEntry(entryId)),
    duplicateEntry: (entryId: string, options: DuplicateEntryOptions) =>
      tracked(repository.duplicateEntry(entryId, options)),
    createSavedMeal: (input: CreateSavedMealInput) =>
      tracked(repository.createSavedMeal(input)),
    deleteSavedMeal: (savedMealId: string) =>
      tracked(repository.deleteSavedMeal(savedMealId)),
    recordSavedMealUse: (savedMealId: string) =>
      tracked(repository.recordSavedMealUse(savedMealId)),
  };
}
