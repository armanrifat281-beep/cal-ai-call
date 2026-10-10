import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type InfoNoteTone = 'info' | 'warning' | 'neutral';

export interface InfoNoteProps {
  /** Short heading, e.g. "Estimates, not measurements". */
  title?: string;
  body: string;
  tone?: InfoNoteTone;
  style?: StyleProp<ViewStyle>;
}

const TONES = {
  info: { bg: 'infoSoft', fg: 'infoOnSoft', border: 'info' },
  warning: { bg: 'warningSoft', fg: 'warningOnSoft', border: 'warning' },
  neutral: { bg: 'surfaceAlt', fg: 'textMuted', border: 'border' },
} as const;

/**
 * The app's standard disclosure block. We use it to state plainly where a
 * number came from and how certain it is.
 */
export function InfoNote({ title, body, tone = 'info', style }: InfoNoteProps) {
  const theme = useTheme();
  const t = TONES[tone];

  return (
    <View
      style={[
        {
          gap: theme.spacing.xs,
          padding: theme.spacing.md,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors[t.bg],
          borderLeftWidth: 3,
          borderLeftColor: theme.colors[t.border],
        },
        style,
      ]}
    >
      {title ? (
        <Text variant="bodySmStrong" color={t.fg}>
          {title}
        </Text>
      ) : null}
      <Text variant="caption" color={t.fg} style={{ lineHeight: 18 }}>
        {body}
      </Text>
    </View>
  );
}
