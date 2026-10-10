import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppError, Result } from '@/lib/result';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
}

export type AsyncResult<T> = AsyncState<T> & { reload: () => void };

/** Shallow identity comparison, which is what a dependency array means. */
function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => Object.is(value, b[index]));
}

/**
 * Runs a read, tracking loading and error state and discarding a result that
 * arrives after the inputs changed or the component unmounted.
 *
 * Loading is derived rather than stored. Each change of the inputs starts a
 * new attempt, and the hook is loading whenever the settled result belongs
 * to an older attempt than the current one. The obvious alternative - setting
 * `loading: true` from inside the effect - schedules a second render for
 * something already knowable during the first, and React's lint rules reject
 * it for that reason.
 *
 * Adjusting state during render, as the attempt counter does, is the pattern
 * React documents for deriving state from changed inputs: the re-render
 * happens before anything is committed, so nothing flashes.
 */
export function useAsyncResult<T>(
  run: () => Promise<Result<T>>,
  deps: readonly unknown[],
): AsyncResult<T> {
  const [nonce, setNonce] = useState(0);
  const key = [...deps, nonce];

  const [attempt, setAttempt] = useState({ id: 0, key });
  if (!sameDeps(attempt.key, key)) {
    setAttempt({ id: attempt.id + 1, key });
  }

  const [settled, setSettled] = useState<{
    id: number;
    data: T | null;
    error: AppError | null;
  } | null>(null);

  // The latest `run`, kept in a ref because it is a new closure every render
  // and must not be a dependency of the effect that calls it. Assigning the
  // ref in its own effect rather than during render keeps it off the render
  // path, and effects run in declaration order, so this is already up to
  // date by the time the effect below fires.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    let active = true;

    void runRef.current().then((result) => {
      if (!active) return;
      setSettled(
        result.ok
          ? { id: attempt.id, data: result.value, error: null }
          : { id: attempt.id, data: null, error: result.error },
      );
    });

    return () => {
      active = false;
    };
  }, [attempt.id]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const isCurrent = settled?.id === attempt.id;

  return {
    // While a new read is in flight the previous data is held rather than
    // blanked, so a refresh does not empty the screen it is refreshing.
    data: settled?.data ?? null,
    loading: !isCurrent,
    error: isCurrent ? (settled?.error ?? null) : null,
    reload,
  };
}
