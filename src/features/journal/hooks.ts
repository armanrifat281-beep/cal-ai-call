import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { todayKey, type DateKey } from '@/lib/date';
import type { AppError, Result } from '@/lib/result';
import { summarizeEntries, type DaySummary } from '@/features/nutrition';
import type { FoodEntry, SavedMeal } from '@/types/domain';

import { createLocalJournalRepository } from './localRepository';
import type { JournalRepository } from './repository';

/**
 * Journal data access for screens.
 *
 * The repository is chosen here and nowhere else. Today it is always the
 * device-local store; once Supabase auth is wired up this is the single place
 * that switches to the server-backed implementation for a signed-in user.
 */

let sharedRepository: JournalRepository | null = null;

export function getJournalRepository(): JournalRepository {
  sharedRepository ??= createLocalJournalRepository();
  return sharedRepository;
}

/** Replaces the active repository. Used by tests and by the auth transition. */
export function setJournalRepository(repository: JournalRepository | null): void {
  sharedRepository = repository;
}

export function useJournalRepository(): JournalRepository {
  return getJournalRepository();
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
}

/**
 * Runs a repository read, tracking loading and error state and ignoring
 * results that arrive after the component unmounted or the key changed.
 */
function useAsyncResult<T>(
  run: () => Promise<Result<T>>,
  deps: readonly unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    let active = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    void runRef.current().then((result) => {
      if (!active) return;
      setState(
        result.ok
          ? { data: result.value, loading: false, error: null }
          : { data: null, loading: false, error: result.error },
      );
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}

export interface DayJournal {
  entries: FoodEntry[];
  summary: DaySummary;
  loading: boolean;
  error: AppError | null;
  reload: () => void;
}

/** Everything one day's dashboard needs. */
export function useDayJournal(dateKey: DateKey = todayKey()): DayJournal {
  const repository = useJournalRepository();
  const { data, loading, error, reload } = useAsyncResult(
    () => repository.listEntriesForDay(dateKey),
    [dateKey, repository],
  );

  const entries = data ?? [];
  const summary = useMemo(() => summarizeEntries(entries), [entries]);

  return { entries, summary, loading, error, reload };
}

export interface RangeJournal {
  entries: FoodEntry[];
  loading: boolean;
  error: AppError | null;
  reload: () => void;
}

export function useRangeJournal(startKey: DateKey, endKey: DateKey): RangeJournal {
  const repository = useJournalRepository();
  const { data, loading, error, reload } = useAsyncResult(
    () => repository.listEntriesForRange(startKey, endKey),
    [startKey, endKey, repository],
  );

  return { entries: data ?? [], loading, error, reload };
}

export function useRecentEntries(limit = 5): RangeJournal {
  const repository = useJournalRepository();
  const { data, loading, error, reload } = useAsyncResult(
    () => repository.listRecentEntries(limit),
    [limit, repository],
  );

  return { entries: data ?? [], loading, error, reload };
}

export interface SavedMealsState {
  savedMeals: SavedMeal[];
  loading: boolean;
  error: AppError | null;
  reload: () => void;
}

export function useSavedMeals(): SavedMealsState {
  const repository = useJournalRepository();
  const { data, loading, error, reload } = useAsyncResult(
    () => repository.listSavedMeals(),
    [repository],
  );

  return { savedMeals: data ?? [], loading, error, reload };
}
