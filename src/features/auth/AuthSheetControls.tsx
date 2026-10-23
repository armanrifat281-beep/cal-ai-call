import { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/ui';

import {
  AUTH_FIELD_BG,
  AUTH_FIELD_BORDER,
  AUTH_INK,
  AUTH_MUTED,
  AUTH_ORANGE,
} from './AuthSheet';

/**
 * The controls inside the account sheet.
 *
 * Separate from the app's own `TextField` and `Button` on purpose. Those read
 * the theme, which on these screens is the black-and-lime one - a lime button
 * on a cream sheet would be the only thing on the orange screens that came
 * from somewhere else. These are the sheet's own furniture and carry its
 * colours directly.
 */

export interface AuthFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Validation message. Shown only once the user has tried to submit. */
  error?: string | null;
  /** Adds the show/hide eye and starts obscured. */
  password?: boolean;
}

export function AuthField({
  label,
  error,
  password = false,
  ...rest
}: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" color={AUTH_INK} style={{ fontSize: 14 }}>
        {label}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: AUTH_FIELD_BG,
          borderRadius: 14,
          borderWidth: 1.5,
          // Three states, told apart without moving anything: resting, being
          // typed into, and wrong.
          borderColor: error ? '#D64545' : focused ? AUTH_ORANGE : AUTH_FIELD_BORDER,
          paddingHorizontal: 16,
        }}
      >
        <TextInput
          // Named for its visible label. The label is a sibling `Text`, so
          // without this a screen reader reaches the field and announces
          // nothing - and the error below it, when there is one, so the
          // field says what is wrong with it rather than only that it is
          // wrong somewhere on the screen.
          accessibilityLabel={label}
          accessibilityHint={error ?? undefined}
          {...rest}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          secureTextEntry={password && !revealed}
          placeholderTextColor="#B8AFA6"
          style={{
            flex: 1,
            paddingVertical: 15,
            fontSize: 15,
            color: AUTH_INK,
          }}
        />

        {password ? (
          <Pressable
            onPress={() => setRevealed((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={12}
            style={{ paddingLeft: 10 }}
          >
            <EyeGlyph crossed={!revealed} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text variant="footnote" color="#C13A3A">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export interface AuthButtonProps {
  label: string;
  onPress: () => void;
  /** `filled` is the one action on the screen; `outline` is the way out. */
  variant?: 'filled' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  /** Drawn to the left of the label, e.g. a provider mark. */
  leading?: React.ReactNode;
  /**
   * Overrides the label colour on an outlined button.
   *
   * The two outlined buttons in this flow mean different things: "Create
   * Account" on the welcome screen is a door into the product and wears the
   * brand orange, while the provider buttons are neutral furniture. Same
   * shape, different weight, one component.
   */
  labelColor?: string;
}

export function AuthButton({
  label,
  onPress,
  variant = 'filled',
  loading = false,
  disabled = false,
  leading,
  labelColor,
}: AuthButtonProps) {
  const filled = variant === 'filled';
  const inert = disabled || loading;

  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: filled ? AUTH_ORANGE : AUTH_FIELD_BG,
        borderRadius: 14,
        borderWidth: filled ? 0 : 1.5,
        borderColor: labelColor ? '#FFD9C6' : AUTH_FIELD_BORDER,
        paddingVertical: 16,
        opacity: inert ? 0.55 : pressed ? 0.88 : 1,
      })}
    >
      {leading}
      <Text
        variant="headline"
        color={labelColor ?? (filled ? '#FFFFFF' : AUTH_INK)}
        style={{ fontWeight: '700' }}
      >
        {loading ? 'Please wait…' : label}
      </Text>
    </Pressable>
  );
}

/** "Or", with a rule either side. */
export function AuthDivider({ label = 'Or' }: { label?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: AUTH_FIELD_BORDER }} />
      <Text variant="footnote" color={AUTH_MUTED}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: AUTH_FIELD_BORDER }} />
    </View>
  );
}

/** A sentence with one word in it that is a button. */
export function AuthPrompt({
  question,
  action,
  onPress,
}: {
  question: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <Text variant="footnote" color={AUTH_MUTED} align="center">
      {question}{' '}
      <Text
        variant="footnote"
        color={AUTH_ORANGE}
        style={{ fontWeight: '700' }}
        onPress={onPress}
        accessibilityRole="button"
      >
        {action}
      </Text>
    </Text>
  );
}

export function AuthCheckbox({
  checked,
  onToggle,
  children,
  accessibilityLabel,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          marginTop: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? AUTH_ORANGE : 'transparent',
          borderWidth: checked ? 0 : 1.5,
          borderColor: '#CFC4B9',
        }}
      >
        {checked ? (
          <Svg width={12} height={12} viewBox="0 0 24 24">
            <Path
              d="M5 13 L10 18 L19 7"
              stroke="#FFFFFF"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

function EyeGlyph({ crossed }: { crossed: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M2.5 12 C5 7.5 8.5 5.5 12 5.5 C15.5 5.5 19 7.5 21.5 12 C19 16.5 15.5 18.5 12 18.5 C8.5 18.5 5 16.5 2.5 12 Z"
        stroke={AUTH_MUTED}
        strokeWidth={1.6}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={12} cy={12} r={2.6} stroke={AUTH_MUTED} strokeWidth={1.6} fill="none" />
      {crossed ? (
        <Path
          d="M4 20 L20 4"
          stroke={AUTH_MUTED}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
    </Svg>
  );
}

export interface AuthNoticeProps {
  /** `problem` is something that went wrong; `note` is context. */
  tone?: 'problem' | 'note';
  message: string;
  detail?: string | null;
  action?: { label: string; onPress: () => void };
}

/**
 * The one place anything goes wrong on an account screen.
 *
 * Directly above the fields rather than beside whichever one is at fault:
 * "that email and password do not match an account" is about the pair, and
 * hanging it under the password field says the password is the problem when
 * it may well be the email.
 */
export function AuthNotice({ tone = 'problem', message, detail, action }: AuthNoticeProps) {
  const problem = tone === 'problem';

  return (
    <View
      accessibilityRole={problem ? 'alert' : undefined}
      style={{
        backgroundColor: problem ? '#FDECEA' : '#FFF2E6',
        borderRadius: 14,
        padding: 14,
        gap: 4,
      }}
    >
      <Text variant="footnote" color={problem ? '#A3291F' : '#8A4A18'} style={{ fontWeight: '600' }}>
        {message}
      </Text>
      {detail ? (
        <Text variant="caption" color={problem ? '#A3291F' : '#8A4A18'}>
          {detail}
        </Text>
      ) : null}
      {action ? (
        <Text
          variant="footnote"
          color={AUTH_ORANGE}
          style={{ fontWeight: '700', marginTop: 4 }}
          onPress={action.onPress}
          accessibilityRole="button"
        >
          {action.label}
        </Text>
      ) : null}
    </View>
  );
}
