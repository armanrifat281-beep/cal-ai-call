import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { todayKey, type DateKey } from '@/lib/date';
import type { AppError, Result } from '@/lib/result';
import { summarizeEntries, type DaySummary } from '@/features/nutrition';
import type { FoodEntry, SavedMeal } from '@/types/domain';

import { useAuth } from '@/features/auth';
import { getSupabaseClient } from '@/lib/supabase';

import { createLocalJournalRepository } from './localRepository';
import type { JournalRepository } from './repository';
import { createSupabaseJournalRepository } from './supabaseRepository';

/**
 * Journal data access for screens.
 *
 * The repository is chosen here and nowhere else:
 *
 *   signed in  -> Supabase, where the data is backed up and protected by RLS
 *   otherwise  -> the device-local store
 *
 * Screens never learn which one they got. That is what lets the app be fully
 * usable before an account exists, and what made the whole journal testable
 * before a backend existed.
 */

let localRepository: JournalRepository | null = null;
let supabaseRepository: JournalRepository | null = null;
/** Set by tests to force a specific implementation. */
let overrideRepository: JournalRepository | null = null;

function getLocalRepository(): JournalRepository {
  localRepository ??= createLocalJournalRepository();
  return localRepository;
}

/**
 * The repository to use outside React, e.g. in a background task.
 *
 * Returns the Supabase one when a client exists AND a session is stored.
 * Prefer `useJournalRepository` inside components, which reacts to sign-in.
 */
export function getJournalRepository(): JournalRepository {
  if (overrideRepository) return overrideRepository;
  return getLocalRepository();
}

/** Replaces the active repository. Used by tests. */
export function setJournalRepository(repository: JournalRepository | null): void {
  overrideRepository = repository;
}

export function useJournalRepository(): JournalRepository {
  const { isSignedIn } = useAuth();

  if (overrideRepository) return overrideRepository;

  if (isSignedIn) {
    const client = getSupabaseClient();
    if (client) {
      // Memoized at module level: the client is a singleton, so the repository
      // built from it can be too, and a new object every render would retrigger
      // every data effect that depends on it.
      supabaseRepository ??= createSupabaseJournalRepository(client);
      return supabaseRepository;
    }
  }

  return getLocalRepository();
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
