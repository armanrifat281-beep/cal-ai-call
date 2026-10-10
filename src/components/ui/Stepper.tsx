import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

export interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Describes what is being counted, e.g. "Servings". */
  label: string;
  /** Rendered beside the number, e.g. "servings". */
  unitLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** A plus/minus counter. Used for the serving-size control. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
  label,
  unitLabel,
  style,
}: StepperProps) {
  const theme = useTheme();
  const canDecrease = value - step >= min;
  const canIncrease = value + step <= max;

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.surfaceAlt,
          borderRadius: theme.radius.pill,
          padding: theme.spacing.xxs,
        },
        style,
      ]}
    >
      <IconButton
        variant="input"
        accessibilityLabel={`Decrease ${label.toLowerCase()}`}
        onPress={() => onChange(Math.max(min, value - step))}
        disabled={!canDecrease}
      >
        <Icon name="close" size={16} color={canDecrease ? 'text' : 'textMuted'} />
      </IconButton>

      <View style={{ minWidth: 72, alignItems: 'center' }}>
        <Text variant="headline">
          {value}
          {unitLabel ? ` ${unitLabel}` : ''}
        </Text>
      </View>

      <IconButton
        variant="input"
        accessibilityLabel={`Increase ${label.toLowerCase()}`}
        onPress={() => onChange(Math.min(max, value + step))}
        disabled={!canIncrease}
      >
        <Icon name="plus" size={18} color={canIncrease ? 'text' : 'textMuted'} />
      </IconButton>
    </View>
  );
}
