import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

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
  const scale = useSharedValue(1);
  const target = scaleTo ?? theme.pressScale;

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
      scale.set(withTiming(target, { duration: theme.duration.press }));
      onPressIn?.(event);
    },
    [scale, target, theme.duration.press, onPressIn],
  );

  const handlePressOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (event) => {
      scale.set(withTiming(1, { duration: theme.duration.fast }));
      onPressOut?.(event);
    },
    [scale, theme.duration.fast, onPressOut],
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
    <Animated.View style={[animatedStyle, disabled ? { opacity: 0.4 } : null]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
