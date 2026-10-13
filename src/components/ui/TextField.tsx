import { useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme';

import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Validation message. When set, the field renders in its error state. */
  error?: string | null;
  /** Explanatory text under the field. Hidden while an error is showing. */
  help?: string;
  required?: boolean;
  /**
   * A small control on the label's row, opposite the label.
   *
   * For things that belong to one field but are not part of it - a "Forgot?"
   * link beside Password. Putting such a link under the input instead splits
   * the email-and-password pair in two, which is how a sign-in form ends up
   * reading as four unrelated controls.
   */
  labelAccessory?: React.ReactNode;
  /**
   * Hides the reveal control on a `secureTextEntry` field.
   *
   * Only for a field whose value is already known to the person typing it
   * and must not be shown - which is rare. A password someone is choosing or
   * recalling is exactly the case where seeing it helps.
   */
  hideRevealToggle?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function TextField({
  label,
  error,
  help,
  required = false,
  labelAccessory,
  hideRevealToggle = false,
  containerStyle,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hasError = Boolean(error);

  /*
    A password you cannot see is a password you cannot check.

    Masking protects against someone reading over a shoulder, which is a real
    risk - but it also means a mistyped character is invisible, and the only
    feedback is "that email and password do not match an account", which
    reads as "you have the wrong password" rather than "you have a typo".

    So the mask stays on by default and the person decides. It resets to
    hidden whenever the field is remounted, never persists, and the control
    only exists on a field that is actually masked.
  */
  const secure = inputProps.secureTextEntry === true;
  const revealable = secure && !hideRevealToggle;
  const masked = secure && !revealed;

  const borderColor = hasError
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={[{ gap: theme.spacing.xs }, containerStyle]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="label" color="textMuted">
          {label}
          {required ? ' *' : ''}
        </Text>
        {labelAccessory}
      </View>

      {/* The border lives on the wrapper, so the reveal control sits inside
          the field rather than beside it. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: theme.radius.control,
          borderWidth: focused || hasError ? 2 : 1,
          borderColor,
          backgroundColor: theme.colors.surface,
        }}
      >
        <TextInput
          {...inputProps}
          secureTextEntry={masked}
          accessibilityLabel={label}
          placeholderTextColor={theme.colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            flex: 1,
            minHeight: 48,
            paddingLeft: theme.spacing.md,
            paddingRight: revealable ? theme.spacing.xs : theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            color: theme.colors.text,
            fontSize: theme.typography.body.fontSize,
          }}
        />

        {revealable ? (
          <Pressable
            onPress={() => setRevealed((shown) => !shown)}
            accessibilityRole="button"
            // Names the action, not the state: a screen reader user needs to
            // know what pressing it will do.
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            accessibilityState={{ selected: revealed }}
            hitSlop={6}
            style={{
              width: 44,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={revealed ? 'eyeOff' : 'eye'}
              size={19}
              color="textMuted"
              strokeWidth={1.7}
            />
          </Pressable>
        ) : null}
      </View>

      {hasError ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : help ? (
        <Text variant="caption" color="textMuted">
          {help}
        </Text>
      ) : null}
    </View>
  );
}
