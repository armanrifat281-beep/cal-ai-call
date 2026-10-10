import { useCallback, useEffect, useRef, useState } from 'react';

export type CountdownStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface Countdown {
  /** Whole seconds left, never below zero. */
  remainingSeconds: number;
  status: CountdownStatus;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Back to the full duration, stopped. */
  reset: () => void;
}

/** How often the display is refreshed. */
const TICK_MS = 250;

/**
 * A countdown for one cooking step.
 *
 * Time left is derived from a wall-clock deadline rather than counted down
 * by the interval. An interval that is throttled - which is what happens the
 * moment the phone sleeps or the app goes to the background, both entirely
 * normal while something is in the oven - would otherwise lose exactly as
 * much time as it was throttled for, and a timer that quietly runs slow is
 * worse than no timer.
 *
 * It stays in the app on purpose. Firing a notification would mean asking
 * for notification permission and then using it, and the one thing the user
 * should never get from a nutrition app is another reason to buzz.
 */
export function useCountdown(totalSeconds: number, onFinish?: () => void): Countdown {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [pausedWith, setPausedWith] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);

  // Held in a ref so a caller passing an inline closure does not restart the
  // interval on every render.
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  const finished = remainingSeconds === 0 && deadline !== null;
  const status: CountdownStatus = finished
    ? 'finished'
    : deadline !== null
      ? 'running'
      : pausedWith !== null
        ? 'paused'
        : 'idle';

  // A changed duration means a different step, so the timer starts over.
  // Done during render rather than from an effect: an effect would let one
  // frame show the previous step's clock against the new step's duration.
  const [forDuration, setForDuration] = useState(totalSeconds);
  if (forDuration !== totalSeconds) {
    setForDuration(totalSeconds);
    setDeadline(null);
    setPausedWith(null);
    setRemainingSeconds(totalSeconds);
  }

  useEffect(() => {
    if (deadline === null) return;

    const update = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left === 0) onFinishRef.current?.();
    };

    update();
    const interval = setInterval(update, TICK_MS);
    return () => clearInterval(interval);
  }, [deadline]);

  const start = useCallback(() => {
    setPausedWith(null);
    setDeadline(Date.now() + totalSeconds * 1000);
  }, [totalSeconds]);

  const pause = useCallback(() => {
    setDeadline((current) => {
      if (current === null) return null;
      setPausedWith(Math.max(0, Math.ceil((current - Date.now()) / 1000)));
      return null;
    });
  }, []);

  const resume = useCallback(() => {
    setPausedWith((paused) => {
      if (paused === null) return null;
      setDeadline(Date.now() + paused * 1000);
      return null;
    });
  }, []);

  const reset = useCallback(() => {
    setDeadline(null);
    setPausedWith(null);
    setRemainingSeconds(totalSeconds);
  }, [totalSeconds]);

  return { remainingSeconds, status, start, pause, resume, reset };
}

/** "12:00", or "1:05:00" once there is an hour on the clock. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
