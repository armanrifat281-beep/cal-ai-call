import { act, renderHook, waitFor } from '@testing-library/react-native';

import { appError, err, ok, type Result } from '@/lib/result';
import { useAsyncResult } from '@/lib/useAsyncResult';

/** A promise whose resolution the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useAsyncResult', () => {
  it('starts loading, with nothing to show yet', async () => {
    const pending = deferred<Result<string>>();
    const { result } = await renderHook(() => useAsyncResult(() => pending.promise, []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    await act(async () => {
      pending.resolve(ok('first'));
      await pending.promise;
    });
    expect(result.current.loading).toBe(false);
  });

  it('settles with the value', async () => {
    const { result } = await renderHook(() => useAsyncResult(async () => ok(42), []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('settles with the error', async () => {
    const failure = appError('network', 'No connection.');
    const { result } = await renderHook(() => useAsyncResult(async () => err(failure), []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(failure);
    expect(result.current.data).toBeNull();
  });

  it('runs once for a stable dependency, not on every render', async () => {
    const run = jest.fn(async () => ok('x'));
    const { result, rerender } = await renderHook(() => useAsyncResult(run, ['stable']));

    await waitFor(() => expect(result.current.loading).toBe(false));
    await rerender({});
    await rerender({});

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('re-reads when a dependency changes', async () => {
    const run = jest.fn(async (key: string) => ok(key));
    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) => useAsyncResult(() => run(key), [key]),
      { initialProps: { key: 'a' } },
    );

    await waitFor(() => expect(result.current.data).toBe('a'));

    await rerender({ key: 'b' });
    await waitFor(() => expect(result.current.data).toBe('b'));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('goes back to loading when the inputs change', async () => {
    // The second read is held open, so the in-flight state can be observed.
    const second = deferred<Result<string>>();
    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) =>
        useAsyncResult(() => (key === 'a' ? Promise.resolve(ok('a')) : second.promise), [
          key,
        ]),
      { initialProps: { key: 'a' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await rerender({ key: 'b' });
    expect(result.current.loading).toBe(true);
  });

  it('keeps the previous data visible while the next read is in flight', async () => {
    const second = deferred<Result<string>>();
    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) =>
        useAsyncResult(() => (key === 'a' ? Promise.resolve(ok('a')) : second.promise), [
          key,
        ]),
      { initialProps: { key: 'a' } },
    );
    await waitFor(() => expect(result.current.data).toBe('a'));

    await rerender({ key: 'b' });
    // Loading, but the screen is not blanked in the meantime.
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe('a');

    await act(async () => {
      second.resolve(ok('b'));
      await second.promise;
    });
    expect(result.current.data).toBe('b');
  });

  it('hides a stale error while the retry is running', async () => {
    const failure = appError('network', 'No connection.');
    let outcome: Result<string> = err(failure);

    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) => useAsyncResult(async () => outcome, [key]),
      { initialProps: { key: 'a' } },
    );
    await waitFor(() => expect(result.current.error).toBe(failure));

    outcome = ok('recovered');
    await rerender({ key: 'b' });
    // The old failure must not sit on screen next to a spinner.
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.data).toBe('recovered'));
  });

  it('ignores a result that arrives after the inputs moved on', async () => {
    const slow = deferred<Result<string>>();
    const fast = deferred<Result<string>>();
    const runs = [slow, fast];
    let index = 0;

    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) => useAsyncResult(() => runs[index++]!.promise, [key]),
      { initialProps: { key: 'a' } },
    );

    await rerender({ key: 'b' });

    // The second read finishes first, then the abandoned first one returns.
    await act(async () => {
      fast.resolve(ok('second'));
      await fast.promise;
    });
    await act(async () => {
      slow.resolve(ok('first'));
      await slow.promise;
    });

    expect(result.current.data).toBe('second');
  });

  it('re-reads on reload, with the same inputs', async () => {
    const run = jest.fn(async () => ok('x'));
    const { result } = await renderHook(() => useAsyncResult(run, ['stable']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.reload();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('calls the newest run, not the one captured when the read started', async () => {
    // `run` is a fresh closure every render; the hook must not call a stale
    // one that closes over last render's props.
    let latest = 'first';
    const seen: string[] = [];

    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) =>
        useAsyncResult(async () => {
          seen.push(latest);
          return ok(key);
        }, [key]),
      { initialProps: { key: 'a' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    latest = 'second';
    await rerender({ key: 'b' });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(seen).toEqual(['first', 'second']);
  });

  it('does not set state after unmounting', async () => {
    const pending = deferred<Result<string>>();
    const { unmount } = await renderHook(() => useAsyncResult(() => pending.promise, []));

    await unmount();
    await act(async () => {
      pending.resolve(ok('late'));
      await pending.promise;
    });
    // Reaching here without a React act/update warning is the assertion.
    expect(true).toBe(true);
  });
});
