import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface SectionProps {
  title?: string;
  /** One supporting line. Not a paragraph. */
  subtitle?: string;
  /** A single trailing text action, e.g. "See all". */
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
  /** Tightens the gap between the heading and the content. */
  dense?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A titled block of content.
 *
 * Deliberately not a box. A section is a heading, a gap, and its content;
 * the grouping comes from the vertical rhythm, not from an outline. Using
 * this everywhere is what makes the spacing consistent between screens
 * without each screen hand-rolling margins.
 */
export function Section({
  title,
  subtitle,
  action,
  children,
  dense = false,
  style,
}: SectionProps) {
  const theme = useTheme();

  return (
    <View style={[{ gap: dense ? theme.spacing.sm : theme.spacing.md }, style]}>
      {title || action ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            {title ? <Text variant="title2">{title}</Text> : null}
            {subtitle ? (
              <Text variant="footnote" color="textMuted">
                {subtitle}
              </Text>
            ) : null}
          </View>

          {action ? (
            <PressableScale
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              hitSlop={10}
              scaleTo={0.95}
            >
              <Text variant="label" color="primaryOnSoft">
                {action.label}
              </Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}

      {children}
    </View>
  );
}
