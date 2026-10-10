import * as Haptics from 'expo-haptics';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Shows a spinner and blocks presses. Use for real in-flight work only. */
  loading?: boolean;
  fullWidth?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Light haptic tap. Off by default so we do not buzz on every control. */
  haptic?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZE_SPEC = {
  sm: { minHeight: 36, paddingH: 'md', text: 'bodySmStrong' },
  md: { minHeight: 48, paddingH: 'base', text: 'bodyStrong' },
  lg: { minHeight: 56, paddingH: 'lg', text: 'subheading' },
} as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leading,
  trailing,
  haptic = false,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const spec = SIZE_SPEC[size];
  const isBlocked = disabled || loading;

  const handlePress = useCallback(() => {
    if (isBlocked) return;
    if (haptic) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        // Haptics are a nicety; a device without them must not break the tap.
      });
    }
    onPress();
  }, [haptic, isBlocked, onPress]);

  const colorsFor = (pressed: boolean) => {
    switch (variant) {
      case 'primary':
        return {
          bg: pressed ? theme.colors.primaryPressed : theme.colors.primary,
          fg: theme.colors.textOnPrimary,
          border: 'transparent',
        };
      case 'accent':
        return {
          bg: pressed ? theme.colors.accentPressed : theme.colors.accent,
          fg: theme.colors.textOnAccent,
          border: 'transparent',
        };
      case 'danger':
        return {
          bg: pressed ? theme.colors.dangerPressed : theme.colors.danger,
          fg: '#FFFFFF',
          border: 'transparent',
        };
      case 'secondary':
        return {
          bg: pressed ? theme.colors.surfacePressed : theme.colors.surface,
          fg: theme.colors.text,
          border: theme.colors.borderStrong,
        };
      case 'ghost':
      default:
        return {
          bg: pressed ? theme.colors.surfacePressed : 'transparent',
          fg: theme.colors.primaryOnSoft,
          border: 'transparent',
        };
    }
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={({ pressed }) => {
        const c = colorsFor(pressed);
        return [
          {
            minHeight: spec.minHeight,
            paddingHorizontal: theme.spacing[spec.paddingH],
            borderRadius: theme.radius.md,
            backgroundColor: c.bg,
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: c.border,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: theme.spacing.sm,
            opacity: isBlocked ? 0.5 : 1,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
          },
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const c = colorsFor(pressed);
        return (
          <>
            {loading ? (
              <ActivityIndicator size="small" color={c.fg} />
            ) : (
              leading
            )}
            <Text variant={spec.text} color={c.fg} numberOfLines={1}>
              {label}
            </Text>
            {trailing ? <View>{trailing}</View> : null}
          </>
        );
      }}
    </Pressable>
  );
}
