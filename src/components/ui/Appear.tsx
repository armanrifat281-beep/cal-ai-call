import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

import { useMotion, useTheme } from '@/theme';

export interface AppearProps {
  children: React.ReactNode;
  /**
   * Position in a run of siblings. Each one waits a little longer than the
   * last, so a list arrives as a cascade rather than a single jump.
   */
  index?: number;
  /** Milliseconds between siblings. */
  stagger?: number;
  /** `up` drifts in from below; `fade` only changes opacity. */
  from?: 'up' | 'fade';
  style?: StyleProp<ViewStyle>;
}

/**
 * Content arriving on screen.
 *
 * Everything on a screen appearing in the same frame is what makes an
 * interface feel like a document that loaded rather than a thing that is
 * alive. A short cascade - a few dozen milliseconds apart - reads as the
 * screen assembling itself, and it also guides the eye down the page in
 * reading order.
 *
 * The delay is capped: past about six items the cascade stops being a
 * flourish and becomes a wait, so later siblings all arrive together.
 *
 * With motion reduced this renders its children plainly, with no wrapper
 * animation at all.
 */
const MAX_STAGGER_STEPS = 6;

/**
 * How long the item at `index` waits before arriving.
 *
 * Capped, so a long list's tail is not still arriving seconds after the
 * screen opened. Exported because this is the part worth testing: whether a
 * wrapper renders during a pending delay is Reanimated's business, and its
 * test shim does not model it.
 */
export function staggerDelay(index: number, stagger: number): number {
  return Math.min(Math.max(index, 0), MAX_STAGGER_STEPS) * stagger;
}

export function Appear({
  children,
  index = 0,
  stagger = 45,
  from = 'up',
  style,
}: AppearProps) {
  const theme = useTheme();
  const motion = useMotion();

  if (!motion.enabled) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  const delay = staggerDelay(index, stagger);
  const entering =
    from === 'up'
      ? FadeInDown.springify()
          .damping(theme.spring.settle.damping)
          .stiffness(theme.spring.settle.stiffness)
          .mass(theme.spring.settle.mass)
          .delay(delay)
      : FadeIn.duration(theme.duration.normal).delay(delay);

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
