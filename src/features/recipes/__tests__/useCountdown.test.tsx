import { act, renderHook } from '@testing-library/react-native';

import { formatCountdown, useCountdown } from '../useCountdown';

describe('formatCountdown', () => {
  it('pads the seconds', () => {
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(9)).toBe('0:09');
  });

  it('adds hours only once there are some', () => {
    expect(formatCountdown(3599)).toBe('59:59');
    expect(formatCountdown(3600)).toBe('1:00:00');
    expect(formatCountdown(3905)).toBe('1:05:05');
  });

  it('never shows a negative clock', () => {
    expect(formatCountdown(-30)).toBe('0:00');
  });
});

describe('useCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  /** Moves both the clock and the timers, as real elapsed time does. */
  const advance = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  };

  it('starts idle, showing the full duration', async () => {
    const { result } = await renderHook(() => useCountdown(600));
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingSeconds).toBe(600);
  });

  it('counts down once started', async () => {
    const { result } = await renderHook(() => useCountdown(600));

    await act(async () => result.current.start());
    expect(result.current.status).toBe('running');

    await advance(10_000);
    expect(result.current.remainingSeconds).toBe(590);
  });

  it('does not lose time when the ticks are throttled', async () => {
    // What happens when the phone sleeps with something in the oven: the
    // interval stops firing, but the clock does not stop.
    const { result } = await renderHook(() => useCountdown(600));
    await act(async () => result.current.start());

    await act(async () => {
      jest.setSystemTime(new Date('2026-10-10T12:05:00Z'));
      jest.advanceTimersByTime(250); // One tick, after five real minutes.
    });

    expect(result.current.remainingSeconds).toBe(300);
  });

  it('holds the clock while paused', async () => {
    const { result } = await renderHook(() => useCountdown(600));
    await act(async () => result.current.start());
    await advance(60_000);

    await act(async () => result.current.pause());
    expect(result.current.status).toBe('paused');
    const atPause = result.current.remainingSeconds;

    await advance(120_000);
    expect(result.current.remainingSeconds).toBe(atPause);
  });

  it('resumes from where it was paused', async () => {
    const { result } = await renderHook(() => useCountdown(600));
    await act(async () => result.current.start());
    await advance(60_000);
    await act(async () => result.current.pause());
    await advance(300_000);

    await act(async () => result.current.resume());
    expect(result.current.status).toBe('running');
    expect(result.current.remainingSeconds).toBe(540);

    await advance(40_000);
    expect(result.current.remainingSeconds).toBe(500);
  });

  it('finishes at zero and stays there', async () => {
    const { result } = await renderHook(() => useCountdown(30));
    await act(async () => result.current.start());

    await advance(31_000);
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.status).toBe('finished');

    await advance(60_000);
    expect(result.current.remainingSeconds).toBe(0);
  });

  it('calls back when it finishes', async () => {
    const onFinish = jest.fn();
    const { result } = await renderHook(() => useCountdown(5, onFinish));

    await act(async () => result.current.start());
    expect(onFinish).not.toHaveBeenCalled();

    await advance(5_000);
    expect(onFinish).toHaveBeenCalled();
  });

  it('does not call back before time is up', async () => {
    const onFinish = jest.fn();
    const { result } = await renderHook(() => useCountdown(600, onFinish));
    await act(async () => result.current.start());
    await advance(599_000);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('goes back to the full duration on reset', async () => {
    const { result } = await renderHook(() => useCountdown(600));
    await act(async () => result.current.start());
    await advance(120_000);

    await act(async () => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingSeconds).toBe(600);
  });

  it('starts over when the step changes', async () => {
    const { result, rerender } = await renderHook(
      ({ seconds }: { seconds: number }) => useCountdown(seconds),
      { initialProps: { seconds: 600 } },
    );
    await act(async () => result.current.start());
    await advance(60_000);

    // Moving to the next step must not leave the previous step's clock
    // running against a different duration.
    await rerender({ seconds: 300 });
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingSeconds).toBe(300);
  });

  it('ignores resume when it was never paused', async () => {
    const { result } = await renderHook(() => useCountdown(600));
    await act(async () => result.current.resume());
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingSeconds).toBe(600);
  });

  it('ignores pause when it was never started', async () => {
    const { result } = await renderHook(() => useCountdown(600));
    await act(async () => result.current.pause());
    expect(result.current.status).toBe('idle');
  });
});
