import { View } from 'react-native';

import { Metric, Surface, Text } from '@/components/ui';
import { NUTRIENT_LABELS, OPTIONAL_KEYS } from '@/features/nutrition';
import { useTheme } from '@/theme';
import type { Nutrients } from '@/types/domain';
import type { OptionalNutrientKey } from '@/features/nutrition';

export interface OtherNutrientsProps {
  totals: Nutrients;
  /** Keys at least one item had no figure for. From `sumNutrients`. */
  incompleteKeys: readonly OptionalNutrientKey[];
}

/**
 * Fibre, sugar, saturated fat and sodium for the day.
 *
 * These are stored on every item and were shown nowhere. Calories and the
 * three macros answer "how much"; these answer most of the questions people
 * actually change their eating over - sodium for blood pressure, sugar and
 * fibre for almost everything else.
 *
 * A value that is partly unknown is marked with a plus rather than being
 * presented as a total. The rule throughout this app is that `null` means
 * unknown and never silently becomes zero; a sodium figure that quietly
 * omitted three foods would be worse than no figure at all, because it
 * would look authoritative.
 */
const UNITS: Record<OptionalNutrientKey, string> = {
  fiberG: 'g',
  sugarG: 'g',
  saturatedFatG: 'g',
  sodiumMg: 'mg',
};

export function OtherNutrients({ totals, incompleteKeys }: OtherNutrientsProps) {
  const theme = useTheme();

  // Nothing to show before anything is logged: four dashes is not content.
  const hasAny = OPTIONAL_KEYS.some((key) => totals[key] !== null);
  if (!hasAny) return null;

  return (
    <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.base }}>
      <Text variant="label" color="textMuted">
        ALSO TODAY
      </Text>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {OPTIONAL_KEYS.map((key) => {
          const value = totals[key];
          const partial = incompleteKeys.includes(key);

          return (
            <View key={key} style={{ flex: 1, gap: 3 }}>
              <Metric
                value={
                  value === null
                    ? '--'
                    : // The plus says "at least this much", which is what a
                      // total missing some of its parts actually means.
                      `${Math.round(value)}${partial ? '+' : ''}`
                }
                unit={value === null ? undefined : UNITS[key]}
                size="s"
                color={value === null ? 'textSubtle' : 'text'}
              />
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {NUTRIENT_LABELS[key]}
              </Text>
            </View>
          );
        })}
      </View>

      {incompleteKeys.length > 0 ? (
        <Text variant="caption" color="textSubtle">
          A plus means some foods had no figure, so the total is a minimum.
        </Text>
      ) : null}
    </Surface>
  );
}
