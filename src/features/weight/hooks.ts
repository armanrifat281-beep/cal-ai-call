import { useCallback, useMemo } from 'react';

import { createRevision } from '@/lib/revision';

import { useAuth } from '@/features/auth';
import type { AppError } from '@/lib/result';
import { getSupabaseClient } from '@/lib/supabase';
import { useAsyncResult } from '@/lib/useAsyncResult';

import { createLocalWeightRepository } from './localRepository';
import type { WeightEntry, WeightRepository } from './repository';
import { createSupabaseWeightRepository } from './supabaseRepository';

/**
 * Weight data access for screens.
 *
 * The repository is chosen here and nowhere else, as the journal does it:
 *
 *   signed in  -> Supabase, backed up and protected by RLS
 *   otherwise  -> the device-local store
 */
let localRepository: WeightRepository | null = null;
let supabaseRepository: WeightRepository | null = null;
let overrideRepository: WeightRepository | null = null;

function getLocalRepository(): WeightRepository {
  localRepository ??= createLocalWeightRepository();
  return localRepository;
}

/** For tests. Pass null to go back to the real one. */
export function setWeightRepository(repository: WeightRepository | null): void {
  overrideRepository = repository;
}

export function getDeviceWeightRepository(): WeightRepository {
  return getLocalRepository();
}

/** Bumped by every write here, so the same card on another tab re-reads. */
const revisions = createRevision();

export function useWeightRepository(): WeightRepository {
  const { isSignedIn } = useAuth();

  if (overrideRepository) return overrideRepository;

  if (isSignedIn) {
    const client = getSupabaseClient();
    if (client) {
      supabaseRepository ??= createSupabaseWeightRepository(client);
      return supabaseRepository;
    }
  }

  return getLocalRepository();
}

export interface WeightHistory {
  entries: readonly WeightEntry[];
  /** The most recent reading, or null before the first one. */
  latest: WeightEntry | null;
  /**
   * Change since the oldest reading within the window, in kg.
   *
   * Null until there are two readings: one weigh-in is a number, not a
   * direction, and a direction is the only thing worth showing.
   */
  changeKg: number | null;
  /** How many days the change is measured over. Null when there is none. */
  changeOverDays: number | null;
  loading: boolean;
  error: AppError | null;
  reload: () => void;
  add: (weightKg: number) => Promise<void>;
  undoLast: () => Promise<void>;
}

/** How far back the headline change looks. */
const WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function useWeightHistory(): WeightHistory {
  const repository = useWeightRepository();
  const revision = revisions.use();
  const { data, loading, error, reload } = useAsyncResult(
    () => repository.list(),
    [repository, revision],
  );

  const entries = useMemo(() => data ?? [], [data]);
  const latest = entries[0] ?? null;

  const { changeKg, changeOverDays } = useMemo(() => {
    if (latest === null || entries.length < 2) {
      return { changeKg: null, changeOverDays: null };
    }

    const cutoff = new Date(latest.measuredAt).getTime() - WINDOW_DAYS * MS_PER_DAY;
    // Entries are newest first, so the last one at or after the cutoff is
    // the oldest reading still inside the window.
    const inWindow = entries.filter(
      (entry) => new Date(entry.measuredAt).getTime() >= cutoff,
    );
    const oldest = inWindow[inWindow.length - 1];
    if (oldest === undefined || oldest.id === latest.id) {
      return { changeKg: null, changeOverDays: null };
    }

    const days = Math.max(
      1,
      Math.round(
        (new Date(latest.measuredAt).getTime() - new Date(oldest.measuredAt).getTime()) /
          MS_PER_DAY,
      ),
    );
    return { changeKg: latest.weightKg - oldest.weightKg, changeOverDays: days };
  }, [entries, latest]);

  const add = useCallback(
    async (weightKg: number) => {
      await repository.add(weightKg);
      revisions.bump();
    },
    [repository],
  );

  const undoLast = useCallback(async () => {
    if (latest === null) return;
    await repository.remove(latest.id);
    revisions.bump();
  }, [latest, repository]);

  return {
    entries,
    latest,
    changeKg,
    changeOverDays,
    loading,
    error,
    reload,
    add,
    undoLast,
  };
}
