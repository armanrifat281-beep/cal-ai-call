import React, { cloneElement, isValidElement, useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface IconButtonProps {
  /** Required: an icon alone is meaningless to a screen reader. */
  accessibilityLabel: string;
  onPress: () => void;
  children: React.ReactNode;
  /**
   * Kept so call sites still read meaningfully. `plain`, `soft` and
   * `outlined` all render the same gradient disc now.
   *
   * `input` is the exception, and the only one: the plus and minus beside a
   * number belong to the field they sit in, not to the screen. Two red discs
   * flanking a quantity would read as two actions rather than as one
   * control.
   */
  variant?: 'plain' | 'soft' | 'outlined' | 'input';
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A round button holding one icon.
 *
 * It wears the same treatment as the pill: the rose-to-crimson gradient
 * running top-left to bottom-right, with the icon painted white. A labelled
 * pill and an icon disc are the same thing at different widths, and until
 * now they looked unrelated.
 *
 * The icon is recoloured here rather than at the call site, for the same
 * reason the pill does it: every existing call chose a colour to suit the
 * transparent background it used to have.
 */
export function IconButton({
  accessibilityLabel,
  onPress,
  children,
  variant = 'plain',
  disabled = false,
  testID,
  style,
}: IconButtonProps) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);

  const isInput = variant === 'input';
  const size = theme.minTouchTarget;

  const shape: ViewStyle = {
    width: size,
    height: size,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const content =
    !isInput && isValidElement<{ color?: string }>(children)
      ? cloneElement(children, { color: theme.colors.textOnPrimary })
      : children;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={[{ opacity: disabled ? 0.45 : 1 }, style]}
    >
      {isInput ? (
        <View
          style={[
            shape,
            {
              backgroundColor: pressed
                ? theme.colors.surfacePressed
                : theme.colors.surfaceAlt,
            },
          ]}
        >
          {content}
        </View>
      ) : (
        <View
          style={[
            shape,
            {
              backgroundColor: pressed
                ? theme.colors.primaryPressed
                : theme.colors.primary,
            },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}
