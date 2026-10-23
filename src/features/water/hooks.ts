import { useCallback, useMemo } from 'react';

import { createRevision } from '@/lib/revision';

import { useAuth } from '@/features/auth';
import { todayKey, type DateKey } from '@/lib/date';
import type { AppError } from '@/lib/result';
import { getSupabaseClient } from '@/lib/supabase';
import { useAsyncResult } from '@/lib/useAsyncResult';

import { createLocalWaterRepository } from './localRepository';
import type { WaterEntry, WaterRepository } from './repository';
import { createSupabaseWaterRepository } from './supabaseRepository';

/**
 * Water data access for screens.
 *
 * The repository is chosen here and nowhere else, exactly as the journal
 * does it:
 *
 *   signed in  -> Supabase, backed up and protected by RLS
 *   otherwise  -> the device-local store
 */
let localRepository: WaterRepository | null = null;
let supabaseRepository: WaterRepository | null = null;
let overrideRepository: WaterRepository | null = null;

function getLocalRepository(): WaterRepository {
  localRepository ??= createLocalWaterRepository();
  return localRepository;
}

/** For tests. Pass null to go back to the real one. */
export function setWaterRepository(repository: WaterRepository | null): void {
  overrideRepository = repository;
}

export function getDeviceWaterRepository(): WaterRepository {
  return getLocalRepository();
}

/** Bumped by every write here, so the same card on another tab re-reads. */
const revisions = createRevision();

export function useWaterRepository(): WaterRepository {
  const { isSignedIn } = useAuth();

  if (overrideRepository) return overrideRepository;

  if (isSignedIn) {
    const client = getSupabaseClient();
    if (client) {
      // Memoized at module level: a new object every render would retrigger
      // every data effect that depends on it.
      supabaseRepository ??= createSupabaseWaterRepository(client);
      return supabaseRepository;
    }
  }

  return getLocalRepository();
}

export interface DayWater {
  entries: readonly WaterEntry[];
  /** Millilitres drunk today. Summed, never stored. */
  totalMl: number;
  loading: boolean;
  error: AppError | null;
  reload: () => void;
  add: (amountMl: number) => Promise<void>;
  /** Takes back the most recent drink. Undo for a mis-tap. */
  undoLast: () => Promise<void>;
}

export function useDayWater(dateKey: DateKey = todayKey()): DayWater {
  const repository = useWaterRepository();
  const revision = revisions.use();
  const { data, loading, error, reload } = useAsyncResult(
    () => repository.listForDay(dateKey),
    [dateKey, repository, revision],
  );

  const entries = useMemo(() => data ?? [], [data]);
  const totalMl = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.amountMl, 0),
    [entries],
  );

  const add = useCallback(
    async (amountMl: number) => {
      await repository.add(amountMl);
      revisions.bump();
    },
    [repository],
  );

  const undoLast = useCallback(async () => {
    // Newest first, so the first row is the one just added.
    const newest = entries[0];
    if (newest === undefined) return;
    await repository.remove(newest.id);
    revisions.bump();
  }, [entries, repository]);

  return { entries, totalMl, loading, error, reload, add, undoLast };
}
