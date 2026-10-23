import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ProgressRing } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/ui';
import { macroSplit } from '@/features/nutrition';
import { useTheme, type ColorKey } from '@/theme';
import type { Nutrients } from '@/types/domain';

/** The composition ring, and the geometry its three arcs are cut from. */
const RING = 92;
const RING_THICKNESS = 9;
const RING_RADIUS = (RING - RING_THICKNESS) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export interface RecipeNutritionCardProps {
  /** Per serving, already scaled to the chosen serving count. */
  nutrients: Nutrients;
  /** Sits under the headline figure, e.g. "per serving". */
  caption?: string;
}

/**
 * A recipe's nutrition, as rings rather than a row of numbers.
 *
 * Four figures in a line is a nutrition label, and a nutrition label is
 * something people's eyes slide off. The ring is read in one glance, and
 * what it shows is the one thing the four numbers could not: the SHAPE of
 * the dish - that it is mostly carbohydrate, or that it carries a lot of
 * protein for its size.
 *
 * The three small rings are shares of this dish's own energy, not of a daily
 * target. A recipe does not know whose day it is going into, and a ring
 * filled against somebody else's goal would be a figure about nothing. The
 * grams are there beside them for anyone who wants the label after all.
 */
export function RecipeNutritionCard({
  nutrients,
  caption = 'per serving',
}: RecipeNutritionCardProps) {
  const theme = useTheme();
  const split = macroSplit(nutrients);

  const macros: { key: ColorKey & ('protein' | 'carbs' | 'fat'); label: string; grams: number; share: number }[] = [
    { key: 'protein', label: 'Protein', grams: nutrients.proteinG, share: split.proteinShare },
    { key: 'fat', label: 'Fat', grams: nutrients.fatG, share: split.fatShare },
    { key: 'carbs', label: 'Carbs', grams: nutrients.carbsG, share: split.carbsShare },
  ];

  // Each arc starts where the previous one ended, walking the circle once.
  let travelled = 0;

  return (
    <View
      style={{
        borderRadius: 22,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.base,
        gap: theme.spacing.base,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.base }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="callout" color="textMuted">
            Total calories
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text variant="metricXL" style={{ fontSize: 34, lineHeight: 38 }}>
              {Math.round(nutrients.caloriesKcal).toLocaleString()}
            </Text>
            <Text variant="callout" color="textSubtle">
              kcal
            </Text>
          </View>
          <Text variant="caption" color="textSubtle">
            {caption}
          </Text>
        </View>

        {/*
          The dish's composition in one ring: three arcs round a single
          circle rather than three separate dials. A flame in the middle
          rather than a repeat of the number beside it.

          Drawn here rather than with `ProgressRing`, which carries one
          value. A ring showing only the protein share would be a figure
          about nothing - the whole point of this one is that the three
          shares close the circle between them.
        */}
        <View
          style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel={
            split.hasData
              ? macros
                  .map((macro) => `${macro.label} ${Math.round(macro.share * 100)}%`)
                  .join(', ')
              : 'Nutrition not known for this recipe'
          }
        >
          <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={RING_RADIUS}
              stroke={theme.colors.surfaceAlt}
              strokeWidth={RING_THICKNESS}
              fill="none"
            />
            {split.hasData
              ? macros.map((macro) => {
                  const dash = macro.share * RING_CIRCUMFERENCE;
                  const offset = -travelled * RING_CIRCUMFERENCE;
                  travelled += macro.share;

                  return (
                    <Circle
                      key={macro.key}
                      cx={RING / 2}
                      cy={RING / 2}
                      r={RING_RADIUS}
                      stroke={theme.colors[macro.key]}
                      strokeWidth={RING_THICKNESS}
                      fill="none"
                      strokeDasharray={`${dash} ${RING_CIRCUMFERENCE - dash}`}
                      strokeDashoffset={offset}
                      // Twelve o'clock, which is where a dial is read from.
                      transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                    />
                  );
                })
              : null}
          </Svg>

          <Icon name="flame" size={22} color="accent" strokeWidth={1.8} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {macros.map((macro) => (
          <View
            key={macro.key}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 6,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.radius.media,
              backgroundColor: theme.colors.surfaceAlt,
            }}
          >
            <ProgressRing
              progress={split.hasData ? macro.share : 0}
              size={54}
              thickness={6}
              color={theme.colors[macro.key]}
              accessibilityLabel={`${macro.label}, ${Math.round(macro.grams)} grams`}
            >
              <Text variant="metricS" style={{ fontSize: 12 }}>
                {Math.round(macro.grams)}g
              </Text>
            </ProgressRing>

            <View style={{ alignItems: 'center' }}>
              <Text variant="caption" color="textMuted">
                {macro.label}
              </Text>
              <Text variant="caption" color={macro.key} style={{ fontWeight: '700' }}>
                {split.hasData ? `${Math.round(macro.share * 100)}%` : '—'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text variant="caption" color="textSubtle">
        Percentages are shares of this dish&apos;s own energy, not of a daily
        target.
      </Text>
    </View>
  );
}
