import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** How much of the target has been used, 0..1. Values above 1 are kept. */
  progress: number;
  /** Outer diameter in points. */
  size: number;
  /** Ring thickness. Scales with size unless given. */
  thickness?: number;
  /** The arc's colour. Defaults to the brand colour. */
  color?: string;
  /** Drawn in the middle. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Read out in place of the ring, which is decoration to a screen reader. */
  accessibilityLabel?: string;
}

/**
 * One value against its target, as a ring.
 *
 * The shape the whole dashboard is built from: once at the top for the day's
 * energy, and three times underneath for the macros. One component rather
 * than three similar ones, so the dial and the small rings cannot drift
 * apart in thickness, cap or sweep.
 *
 * Starts at twelve o'clock and fills clockwise, which is the direction a
 * dial is read. Over target it keeps going round rather than clamping: a day
 * at 130% should look like a day at 130%, not like a finished one.
 *
 * The track is always drawn. A ring at 4% with no track is a stray tick that
 * reads as a rendering fault rather than as a number.
 */
export function ProgressRing({
  progress,
  size,
  thickness,
  color,
  children,
  style,
  accessibilityLabel,
}: ProgressRingProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  const stroke = thickness ?? Math.max(6, Math.round(size * 0.1));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Beyond one full turn the arc is a complete circle anyway, so the sweep is
  // capped for drawing while the number above it still says 130%.
  const target = Math.max(0, Math.min(progress, 1));
  const sweep = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    sweep.value = reduceMotion ? target : withTiming(target, { duration: 620 });
  }, [target, reduceMotion, sweep]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - sweep.value),
  }));

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessibilityRole={accessibilityLabel ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? theme.colors.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Rotated so the arc begins at the top rather than at three
          // o'clock, which is where SVG starts an arc.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {children === undefined ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}
