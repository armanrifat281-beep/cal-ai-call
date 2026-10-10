import { useReducedMotion } from 'react-native-reanimated';

export interface Motion {
  /**
   * False when the operating system's "reduce motion" setting is on. Every
   * animation in the app checks this.
   */
  enabled: boolean;
  /**
   * A duration to animate for: the one given, or zero when motion is
   * reduced, so an animation becomes an instant state change rather than
   * being skipped and leaving the view in its starting state.
   */
  duration: (ms: number) => number;
}

/**
 * Whether to animate.
 *
 * iOS and Android both let people turn motion down, and for some that is
 * not a preference but the difference between using an app and feeling ill.
 * Reanimated reports the setting; this makes it one call so no animation in
 * the app has to remember to ask.
 *
 * Reducing motion means going straight to the end state, never skipping it.
 * An animation that is skipped rather than shortened leaves a view faded out
 * or scaled to nothing, which is a far worse outcome than the movement was.
 */
export function useMotion(): Motion {
  const reduced = useReducedMotion();
  const enabled = !reduced;

  return {
    enabled,
    duration: (ms: number) => (enabled ? ms : 0),
  };
}
