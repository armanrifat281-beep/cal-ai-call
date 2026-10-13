import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useMotion, useTheme } from '@/theme';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Light tap feedback. On for navigation and commits, off for list rows. */
  haptic?: boolean;
  /** How far to scale down. Defaults to the theme value. */
  scaleTo?: number;
}

/**
 * A pressable that physically responds to touch.
 *
 * Flipping a background colour on press is the cheapest possible feedback and
 * it reads as a web page. A small scale, driven on the UI thread so it cannot
 * be delayed by JavaScript work, is what makes a tap feel like it landed on
 * something. Kept subtle: 2.5% at 90ms is felt rather than seen.
 */
/**
 * One element, carrying both the caller's style and the animated transform.
 *
 * This used to be a `Pressable` inside an `Animated.View`, with the caller's
 * style on the inner one. Any layout the caller asked for - `flex`, `width`,
 * `alignSelf` - was then applied to a child of a wrapper that sized itself
 * to its content, so it did nothing: three `flex` buttons in a row came out
 * squashed against the left edge with their labels clipped. Merging them
 * means the element the parent lays out is the element the caller styled.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  children,
  style,
  haptic = false,
  scaleTo,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const theme = useTheme();
  const motion = useMotion();
  const scale = useSharedValue(1);
  // With motion reduced there is no scale at all: shrinking instantly would
  // be a flicker, which is the thing the setting exists to avoid.
  const target = motion.enabled ? (scaleTo ?? theme.pressScale) : 1;

  // `.get()` and `.set()` rather than `.value`: assigning to `.value` is a
  // mutation the React Compiler rejects, and these are the accessors
  // Reanimated added for exactly that reason.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  // The caller's handlers still run: a button tracks its own pressed state to
  // swap the gradient, and must not lose that by using this wrapper.
  const handlePressIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (event) => {
      scale.set(withSpring(target, theme.spring.press));
      onPressIn?.(event);
    },
    [scale, target, theme.spring.press, onPressIn],
  );

  const handlePressOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (event) => {
      scale.set(withSpring(1, theme.spring.press));
      onPressOut?.(event);
    },
    [scale, theme.spring.press, onPressOut],
  );

  const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      if (haptic) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          // A device without haptics must not break the tap.
        });
      }
      onPress?.(event);
    },
    [haptic, onPress],
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle, disabled ? { opacity: 0.4 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
}
