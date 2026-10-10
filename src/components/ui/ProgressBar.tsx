import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { ColorKey } from '@/theme';

export interface ProgressBarProps {
  /** 0..1. Values outside the range are clamped. */
  value: number;
  color?: ColorKey;
  trackColor?: ColorKey;
  height?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  value,
  color = 'primary',
  trackColor = 'surfaceAlt',
  height = 8,
  accessibilityLabel,
  style,
}: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        {
          height,
          borderRadius: height / 2,
          backgroundColor: theme.colors[trackColor],
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: theme.colors[color],
        }}
      />
    </View>
  );
}
