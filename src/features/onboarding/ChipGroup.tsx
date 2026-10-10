import { View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export interface ChipGroupProps<T extends string> {
  label?: string;
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  /** Help text under the group, e.g. "Pick as many as you like". */
  help?: string;
}

/** A wrapping set of multi-select chips. */
export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  help,
}: ChipGroupProps<T>) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {label ? (
        <Text variant="label" color="textMuted">
          {label}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={selected.includes(option.value)}
            onPress={() => onToggle(option.value)}
          />
        ))}
      </View>

      {help ? (
        <Text variant="caption" color="textMuted">
          {help}
        </Text>
      ) : null}
    </View>
  );
}
