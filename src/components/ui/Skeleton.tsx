import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

import { useMotion, useTheme } from '@/theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A gently pulsing placeholder. Used while real data is loading. */
export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const theme = useTheme();
  const motion = useMotion();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    // A placeholder that pulses forever is exactly the kind of looping
    // motion the setting exists to stop. It still reads as a placeholder
    // held at a steady tone.
    if (!motion.enabled) {
      opacity.set(0.75);
      return;
    }
    opacity.set(withRepeat(withTiming(1, { duration: 820 }), -1, true));
  }, [opacity, motion.enabled]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.xs,
          backgroundColor: theme.colors.skeleton,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
