import { useSyncExternalStore } from 'react';

/**
 * A counter that changes whenever a collection is written to.
 *
 * The tabs stay mounted. A hook that reads on mount and depends only on its
 * arguments never reads again, so a value written on one screen does not
 * appear on another until something forces a remount. Calling `reload()`
 * after a write only fixes the hook instance that did the writing - the same
 * card on another tab is a different instance and is never told.
 *
 * `features/journal/revision.ts` solves this for the journal and carries the
 * fuller explanation. This is the same idea with no repository wrapping,
 * for the smaller collections whose writes all go through one hook.
 */
export interface Revision {
  /** Call after a successful write. */
  bump: () => void;
  /** Put in a read's dependency list and the read re-runs after any write. */
  use: () => number;
  /** Tests only, so one test's writes cannot leak into the next. */
  reset: () => void;
}

export function createRevision(): Revision {
  let revision = 0;
  const listeners = new Set<() => void>();

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const get = () => revision;

  return {
    bump: () => {
      revision += 1;
      listeners.forEach((listener) => listener());
    },
    use: () => useSyncExternalStore(subscribe, get, get),
    reset: () => {
      revision = 0;
      listeners.clear();
    },
  };
}
