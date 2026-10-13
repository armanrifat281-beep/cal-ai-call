import { useMemo } from 'react';

import {
  groupByDateKey,
  lastSevenDayKeys,
  todayKey,
  type DateKey,
} from '@/lib/date';
import type { AppError } from '@/lib/result';
import { useAsyncResult } from '@/lib/useAsyncResult';
import {
  computeEntryTotals,
  summarizeEntries,
  type DaySummary,
} from '@/features/nutrition';
import type { FoodEntry, SavedMeal } from '@/types/domain';
import type { WeekStripDay } from '@/components/nutrition';

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
export function getDeviceJournalRepository(): JournalRepository {
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

  // `data ?? []` is a new array on every render while data is null, which
  // would make the summary recompute each time.
  const entries = useMemo(() => data ?? [], [data]);
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

export interface WeekStrip {
  days: readonly WeekStripDay[];
  loading: boolean;
  error: AppError | null;
  reload: () => void;
}

/**
 * The seven days ending at `endKey`, shaped for `WeekStrip`.
 *
 * Both the journal and home draw this strip, and the grouping it needs -
 * entries bucketed by local day, each day's calories totalled - is fiddly
 * enough that having it written out twice would guarantee the two drifted.
 */
export function useWeekStripDays(endKey: DateKey = todayKey()): WeekStrip {
  const keys = useMemo(() => lastSevenDayKeys(endKey), [endKey]);
  const range = useRangeJournal(keys[0] ?? endKey, endKey);

  const days = useMemo<WeekStripDay[]>(() => {
    const byDay = groupByDateKey(range.entries, (entry) => entry.consumedAt);
    return keys.map((key) => {
      const dayEntries = byDay.get(key) ?? [];
      return {
        dateKey: key,
        caloriesKcal: dayEntries.reduce(
          (sum, entry) => sum + computeEntryTotals(entry).nutrients.caloriesKcal,
          0,
        ),
        entryCount: dayEntries.length,
      };
    });
  }, [range.entries, keys]);

  return { days, loading: range.loading, error: range.error, reload: range.reload };
}

export interface DayAndWeek extends DayJournal {
  /** The seven days ending on `dateKey`, for the strip. */
  week: readonly WeekStripDay[];
}

/**
 * One day and the week it sits in, from a single read.
 *
 * Home draws both, and asking for them separately meant two requests where
 * the week's range already contained the day. Worse than the extra round
 * trip: they were two independent reads, so after saving a meal the dial
 * and the strip could briefly disagree about the same day.
 *
 * The journal screen still uses `useDayJournal` and `useWeekStripDays`
 * separately, because there the selected day and the strip's window move
 * independently of each other.
 */
export function useDayAndWeek(dateKey: DateKey = todayKey()): DayAndWeek {
  const keys = useMemo(() => lastSevenDayKeys(dateKey), [dateKey]);
  const range = useRangeJournal(keys[0] ?? dateKey, dateKey);

  const byDay = useMemo(
    () => groupByDateKey(range.entries, (entry) => entry.consumedAt),
    [range.entries],
  );

  const entries = useMemo(() => byDay.get(dateKey) ?? [], [byDay, dateKey]);
  const summary = useMemo(() => summarizeEntries(entries), [entries]);

  const week = useMemo<WeekStripDay[]>(
    () =>
      keys.map((key) => {
        const dayEntries = byDay.get(key) ?? [];
        return {
          dateKey: key,
          caloriesKcal: dayEntries.reduce(
            (sum, entry) => sum + computeEntryTotals(entry).nutrients.caloriesKcal,
            0,
          ),
          entryCount: dayEntries.length,
        };
      }),
    [byDay, keys],
  );

  return {
    entries,
    summary,
    week,
    loading: range.loading,
    error: range.error,
    reload: range.reload,
  };
}
