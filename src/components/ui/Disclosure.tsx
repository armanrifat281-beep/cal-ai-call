import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface DisclosureProps {
  /** The one line always visible. Keep it short and specific. */
  summary: string;
  /** The explanation, revealed on tap. */
  detail?: string;
  /** `caution` tints the summary for things the user must not miss. */
  tone?: 'quiet' | 'caution';
  style?: StyleProp<ViewStyle>;
}

/**
 * A single line of disclosure that expands on tap.
 *
 * This replaces the old callout box. An earlier revision had 29 tinted,
 * bordered explanation panels across 23 screens - two or three stacked on
 * some of them - which is both the look of a generated app and genuinely
 * worse at communicating: a wall of warnings gets skipped.
 *
 * The honesty requirements have not moved. Where a number is an estimate, or
 * an allergen filter is not a safety guarantee, that still has to be on the
 * screen. It is now one quiet line with the full explanation one tap away,
 * which is how a real product handles a caveat it means.
 */
export function Disclosure({
  summary,
  detail,
  tone = 'quiet',
  style,
}: DisclosureProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const color = tone === 'caution' ? 'warningOnSoft' : 'textMuted';

  if (!detail) {
    return (
      <View
        style={[
          { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
          style,
        ]}
      >
        <Icon name="info" size={15} color={color} strokeWidth={1.7} />
        <Text variant="footnote" color={color} style={{ flex: 1 }}>
          {summary}
        </Text>
      </View>
    );
  }

  return (
    <View style={[{ gap: theme.spacing.sm }, style]}>
      <PressableScale
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={summary}
        accessibilityHint={open ? 'Hides the explanation' : 'Shows the full explanation'}
        scaleTo={0.99}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}
        >
          <Icon name="info" size={15} color={color} strokeWidth={1.7} />
          <Text variant="footnote" color={color} style={{ flex: 1 }}>
            {summary}
          </Text>
          <Icon
            name={open ? 'chevronUp' : 'chevronDown'}
            size={14}
            color={color}
            strokeWidth={1.7}
          />
        </View>
      </PressableScale>

      {open ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={{
            paddingLeft: theme.spacing.base + theme.spacing.sm,
            paddingRight: theme.spacing.sm,
          }}
        >
          <Text variant="footnote" color="textMuted">
            {detail}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
