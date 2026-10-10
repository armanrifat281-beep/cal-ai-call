import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface CollapsibleProps {
  title: string;
  /**
   * What is currently chosen inside, in a few words.
   *
   * Required, and the reason this component is usable at all: a section
   * that hides its contents must still say what is in them, or collapsing
   * it has traded a long screen for an unknown one.
   */
  summary: string;
  /** Open on first render. For a section the user has already changed. */
  defaultOpen?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A section of a form that folds away.
 *
 * `Disclosure` is for a sentence of explanation; this is for controls. It
 * exists because the recipe form asked seven questions in a row - thirty-four
 * cuisines, fifteen pieces of equipment - before the user could reach the
 * button, when six of those questions have a sensible default and most
 * people will never change them.
 *
 * The summary line is what makes it honest. Folding a choice away is only
 * acceptable while the current choice is still legible from the outside.
 */
export function Collapsible({
  title,
  summary,
  defaultOpen = false,
  children,
  style,
}: CollapsibleProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={[{ gap: theme.spacing.md }, style]}>
      <PressableScale
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}. ${summary}`}
        accessibilityHint={open ? 'Hides these options' : 'Shows these options'}
        scaleTo={0.995}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title2">{title}</Text>
            <Text variant="footnote" color="textMuted" numberOfLines={1}>
              {summary}
            </Text>
          </View>
          <Icon
            name={open ? 'chevronUp' : 'chevronDown'}
            size={18}
            color="textSubtle"
            strokeWidth={1.8}
          />
        </View>
      </PressableScale>

      {open ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={{ gap: theme.spacing.md }}
        >
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}
