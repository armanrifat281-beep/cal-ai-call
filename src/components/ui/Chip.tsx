import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Rendered before the label, e.g. a count or a small mark. */
  leading?: React.ReactNode;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** A selectable pill. Used for preferences, cuisines, and filters. */
export function Chip({
  label,
  selected = false,
  onPress,
  leading,
  disabled = false,
  testID,
  style,
}: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'checkbox' : 'text'}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      style={({ pressed }) => [
        {
          minHeight: 40,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected
            ? theme.colors.primarySoft
            : pressed
              ? theme.colors.surfacePressed
              : theme.colors.surface,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {leading}
      <Text
        variant={selected ? 'label' : 'callout'}
        color={selected ? 'primaryOnSoft' : 'text'}
      >
        {label}
      </Text>
    </Pressable>
  );
}
