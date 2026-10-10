import { View } from 'react-native';

import { Text } from '@/components/ui';
import { macroSplit } from '@/features/nutrition';
import { useTheme } from '@/theme';
import type { Nutrients } from '@/types/domain';

export interface MacroBarProps {
  nutrients: Nutrients;
  /** Show the protein/carbs/fat legend under the bar. */
  showLegend?: boolean;
  height?: number;
}

/**
 * A single bar showing how a meal's calories split across protein, carbs and
 * fat. One bar reads faster than a pie chart at this size, and it degrades to
 * an honest empty state when there is nothing to split.
 */
export function MacroBar({ nutrients, showLegend = true, height = 10 }: MacroBarProps) {
  const theme = useTheme();
  const split = macroSplit(nutrients);

  const segments = [
    { key: 'protein', share: split.proteinShare, color: theme.colors.protein, label: 'Protein', grams: nutrients.proteinG },
    { key: 'carbs', share: split.carbsShare, color: theme.colors.carbs, label: 'Carbs', grams: nutrients.carbsG },
    { key: 'fat', share: split.fatShare, color: theme.colors.fat, label: 'Fat', grams: nutrients.fatG },
  ];

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        accessibilityRole="image"
        accessibilityLabel={
          split.hasData
            ? `Calorie split: ${segments
                .map((s) => `${s.label} ${Math.round(s.share * 100)} percent`)
                .join(', ')}`
            : 'No macro data yet'
        }
        style={{
          flexDirection: 'row',
          height,
          borderRadius: height / 2,
          overflow: 'hidden',
          backgroundColor: theme.colors.surfaceAlt,
        }}
      >
        {split.hasData
          ? segments.map((segment) =>
              segment.share > 0 ? (
                <View
                  key={segment.key}
                  style={{ flex: segment.share, backgroundColor: segment.color }}
                />
              ) : null,
            )
          : null}
      </View>

      {showLegend ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.base }}>
          {segments.map((segment) => (
            <View
              key={segment.key}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: segment.color,
                }}
              />
              <Text variant="caption" color="textMuted">
                {segment.label}
              </Text>
              <Text variant="caption">
                {segment.grams < 10
                  ? `${segment.grams.toFixed(1)} g`
                  : `${Math.round(segment.grams)} g`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
