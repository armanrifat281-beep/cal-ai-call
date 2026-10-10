import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONE_KEYS = {
  neutral: { bg: 'surfaceAlt', fg: 'textMuted' },
  primary: { bg: 'primarySoft', fg: 'primaryOnSoft' },
  accent: { bg: 'accentSoft', fg: 'accentOnSoft' },
  success: { bg: 'successSoft', fg: 'successOnSoft' },
  warning: { bg: 'warningSoft', fg: 'warningOnSoft' },
  danger: { bg: 'dangerSoft', fg: 'dangerOnSoft' },
  info: { bg: 'infoSoft', fg: 'infoOnSoft' },
} as const;

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Optional leading glyph, e.g. a dot or a small emoji-free symbol. */
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, tone = 'neutral', leading, style }: BadgeProps) {
  const theme = useTheme();
  const keys = TONE_KEYS[tone];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          alignSelf: 'flex-start',
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xxs + 2,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors[keys.bg],
        },
        style,
      ]}
    >
      {leading}
      <Text variant="caption" color={keys.fg}>
        {label}
      </Text>
    </View>
  );
}
