import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { StyleProp, TextStyle } from 'react-native';

import { useMotion, useTheme, type Palette, type TypographyVariant } from '@/theme';

import { Text } from './Text';

export interface AnimatedNumberProps {
  /** The number to show. A change animates the figure's arrival. */
  value: number;
  /** Digits after the decimal point. Totals are whole; grams are not. */
  decimals?: number;
  /** Appended without a gap, e.g. `g` or `%`. */
  suffix?: string;
  variant?: TypographyVariant;
  color?: keyof Palette | (string & {});
  accessibilityLabel?: string;
  /** Passed through: a figure inside a dial has to shrink rather than wrap. */
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  /** Type overrides, for a figure a screen wants larger than its variant. */
  style?: StyleProp<TextStyle>;
}

/**
 * A figure that reacts when it changes.
 *
 * The digits are always the real value. An earlier version counted up to it
 * by rounding a spring's progress, which looked expensive and was wrong: the
 * number on screen then depended on the animation driver running. In a
 * stalled frame loop it froze part-way, so a 1100 kcal day could sit there
 * reading `2`. A figure is content, not decoration, and must never be
 * sourced from an animation.
 *
 * So the value is rendered directly and the *arrival* is animated instead -
 * a short lift and settle, on properties that carry no information. If the
 * animation never runs, nothing is lost but the flourish.
 *
 * It pairs with the `metric*` type styles, which lock digit width: without
 * tabular figures a changing number shifts sideways as it redraws.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix,
  variant = 'metricL',
  color = 'text',
  accessibilityLabel,
  numberOfLines,
  adjustsFontSizeToFit,
  style,
}: AnimatedNumberProps) {
  const theme = useTheme();
  const motion = useMotion();

  const lift = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (!motion.enabled) return;
    // Down a little and back, which reads as the figure landing rather than
    // being swapped. The dip in opacity covers the digit change itself.
    lift.set(withSequence(withTiming(-6, { duration: 0 }), withSpring(0, theme.spring.settle)));
    fade.set(withSequence(withTiming(0.4, { duration: 0 }), withTiming(1, { duration: theme.duration.normal })));
  }, [value, motion.enabled, lift, fade, theme.spring.settle, theme.duration.normal]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.get() }],
    opacity: fade.get(),
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text
        variant={variant}
        color={color}
        numberOfLines={numberOfLines}
        adjustsFontSizeToFit={adjustsFontSizeToFit}
        style={style}
        accessibilityLabel={accessibilityLabel}
      >
        {`${value.toFixed(decimals)}${suffix ?? ''}`}
      </Text>
    </Animated.View>
  );
}
