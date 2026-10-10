import { View } from 'react-native';

import { Text } from '@/components/ui';
import { macroSplit } from '@/features/nutrition';
import { useTheme } from '@/theme';
import type { Nutrients } from '@/types/domain';

export interface MacroBarProps {
  nutrients: Nutrients;
  /** Show the protein/carbs/fat readout under the bar. */
  showLegend?: boolean;
  height?: number;
}

/**
 * How a meal's energy splits across protein, carbs and fat.
 *
 * One bar, because at phone width a bar is read faster than a ring or a pie
 * and degrades honestly to an empty track when there is nothing to split.
 * The legend sets the gram figures in tabular digits so they line up down a
 * list of meals.
 */
export function MacroBar({ nutrients, showLegend = true, height = 6 }: MacroBarProps) {
  const theme = useTheme();
  const split = macroSplit(nutrients);

  const segments = [
    { key: 'protein', share: split.proteinShare, color: theme.colors.protein, label: 'Protein', grams: nutrients.proteinG },
    { key: 'carbs', share: split.carbsShare, color: theme.colors.carbs, label: 'Carbs', grams: nutrients.carbsG },
    { key: 'fat', share: split.fatShare, color: theme.colors.fat, label: 'Fat', grams: nutrients.fatG },
  ];

  const formatGrams = (grams: number) =>
    grams < 10 ? grams.toFixed(1) : String(Math.round(grams));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        accessibilityRole="image"
        accessibilityLabel={
          split.hasData
            ? `Energy split: ${segments
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
          // A 1px gap between segments reads as deliberate rather than as a
          // rendering artefact where two similar colours meet.
          gap: split.hasData ? 1.5 : 0,
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
        <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
          {segments.map((segment) => (
            <View
              key={segment.key}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  backgroundColor: segment.color,
                }}
              />
              <Text variant="caption" color="textMuted">
                {segment.label}
              </Text>
              <Text variant="metricS">{formatGrams(segment.grams)}g</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
