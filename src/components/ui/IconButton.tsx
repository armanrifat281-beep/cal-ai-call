import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface IconButtonProps {
  /** Required: an icon alone is meaningless to a screen reader. */
  accessibilityLabel: string;
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'plain' | 'soft' | 'outlined';
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

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

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: theme.minTouchTarget,
          height: theme.minTouchTarget,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            variant === 'soft'
              ? pressed
                ? theme.colors.surfacePressed
                : theme.colors.surfaceAlt
              : pressed
                ? theme.colors.surfacePressed
                : 'transparent',
          borderWidth: variant === 'outlined' ? 1 : 0,
          borderColor: theme.colors.border,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
