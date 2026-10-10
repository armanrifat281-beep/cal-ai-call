import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type TypographyVariant } from '@/theme';
import type { Palette } from '@/theme';

import { Text } from './Text';

export type MetricSize = 'xl' | 'l' | 'm' | 's';

const VARIANTS: Record<MetricSize, TypographyVariant> = {
  xl: 'metricXL',
  l: 'metricL',
  m: 'metricM',
  s: 'metricS',
};

/** The unit sits a step down from the number it belongs to. */
const UNIT_VARIANTS: Record<MetricSize, TypographyVariant> = {
  xl: 'title2',
  l: 'headline',
  m: 'footnote',
  s: 'caption',
};

export interface MetricProps {
  /** The number, already formatted. Pass "412", not "412 kcal". */
  value: string;
  /** The unit, set smaller and lighter beside the number. */
  unit?: string;
  /** A label above or below, depending on `labelPosition`. */
  label?: string;
  labelPosition?: 'above' | 'below';
  size?: MetricSize;
  color?: keyof Palette;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<ViewStyle>;
}

/**
 * A number with its unit and label.
 *
 * Two things this gets right that hand-rolled markup kept getting wrong:
 * the digits are tabular, so a total does not shift sideways as it changes;
 * and the unit is typographically subordinate to the number rather than the
 * same size, so "412 kcal" reads as one value instead of two words.
 */
export function Metric({
  value,
  unit,
  label,
  labelPosition = 'below',
  size = 'l',
  color = 'text',
  align = 'left',
  style,
}: MetricProps) {
  const theme = useTheme();

  const alignItems =
    align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

  const labelNode = label ? (
    <Text variant={size === 'xl' || size === 'l' ? 'footnote' : 'caption'} color="textMuted">
      {label}
    </Text>
  ) : null;

  return (
    <View
      style={[{ alignItems, gap: size === 'xl' ? theme.spacing.xs : 2 }, style]}
      accessibilityLabel={
        label ? `${label}: ${value}${unit ? ` ${unit}` : ''}` : `${value}${unit ? ` ${unit}` : ''}`
      }
    >
      {labelPosition === 'above' ? labelNode : null}

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text variant={VARIANTS[size]} color={color}>
          {value}
        </Text>
        {unit ? (
          <Text variant={UNIT_VARIANTS[size]} color="textMuted">
            {unit}
          </Text>
        ) : null}
      </View>

      {labelPosition === 'below' ? labelNode : null}
    </View>
  );
}
