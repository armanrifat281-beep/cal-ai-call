import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme';

import { Text } from './Text';

export interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** Secondary line under the label, e.g. an amount. */
  detail?: string;
  /** Rendered at the end of the row, e.g. a substitution hint. */
  trailing?: React.ReactNode;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A labelled checkbox row.
 *
 * The whole row is the hit target, which matters when someone is ticking off
 * ingredients with one hand in a kitchen.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  detail,
  trailing,
  disabled = false,
  testID,
  style,
}: CheckboxProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: theme.minTouchTarget + 6,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.control,
          backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: theme.radius.xs,
          borderWidth: checked ? 0 : 2,
          borderColor: theme.colors.borderStrong,
          backgroundColor: checked ? theme.colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Icon name="check" size={16} color={theme.colors.textOnPrimary} strokeWidth={2.6} />
        ) : null}
      </View>

      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text
          variant="body"
          color={checked ? 'textMuted' : 'text'}
          style={checked ? { textDecorationLine: 'line-through' } : undefined}
        >
          {label}
        </Text>
        {detail ? (
          <Text variant="callout" color="textMuted">
            {detail}
          </Text>
        ) : null}
      </View>

      {trailing}
    </Pressable>
  );
}
