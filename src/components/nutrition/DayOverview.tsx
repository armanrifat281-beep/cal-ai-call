import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { DayPlate, dayPlateSegments } from '@/components/charts';
import { AnimatedNumber, Disclosure, Skeleton, Surface, Text } from '@/components/ui';
import {
  computeDailyProgress,
  describeIncompleteTotals,
  formatPercent,
  type DaySummary,
} from '@/features/nutrition';
import { useTheme } from '@/theme';
import type { DailyTargets } from '@/types/domain';

export interface DayOverviewProps {
  summary: DaySummary;
  targets: DailyTargets;
  /** Shown as the eyebrow, e.g. "Today". */
  dayLabel: string;
  /**
   * `compact` drops the dial and leads with the figure instead.
   *
   * For screens that already carry a ring - the journal's week strip is
   * seven of them - where a second, larger one says the same thing twice
   * and makes the page look like a collection of charts.
   */
  variant?: 'full' | 'compact';
}

const MACROS = [
  { key: 'protein', label: 'Protein', color: 'protein', grams: 'proteinG' },
  { key: 'carbs', label: 'Carbs', color: 'carbs', grams: 'carbsG' },
  { key: 'fat', label: 'Fat', color: 'fat', grams: 'fatG' },
] as const;

/**
 * The day, at the top of a screen.
 *
 * One figure inside one dial, then the grams underneath. This replaced a
 * stack of a number, a progress bar, a macro bar and a second progress bar -
 * four separate widgets saying four things, which is how a screen ends up
 * looking like a dashboard rather than a page about food.
 *
 * The legend is not decoration: the dial shows proportions, and proportions
 * alone cannot tell you whether you have had enough protein. The grams do
 * that, and they also carry the chart for anyone who cannot separate its
 * colours.
 */
export function DayOverview({
  summary,
  targets,
  dayLabel,
  variant = 'full',
}: DayOverviewProps) {
  const theme = useTheme();
  const { totals, containsEstimates } = summary;

  const progress = computeDailyProgress(totals.nutrients, targets);
  const incompleteNote = describeIncompleteTotals(totals.incompleteKeys);
  const segments = useMemo(() => dayPlateSegments(summary), [summary]);

  const proteinTarget = progress.protein.target;

  return (
    <Surface
      variant="raised"
      padding="lg"
      style={{ gap: variant === 'full' ? theme.spacing.lg : theme.spacing.base }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="caption" color="textMuted">
          {dayLabel.toUpperCase()}
        </Text>
        {progress.calories.target !== null ? (
          <Text
            variant="caption"
            color={progress.calories.isOver ? 'warningOnSoft' : 'textMuted'}
          >
            {progress.calories.isOver
              ? `${formatPercent(progress.calories.ratio)} of target`
              : formatPercent(progress.calories.ratio)}
          </Text>
        ) : null}
      </View>

      {variant === 'full' ? (
        // The dial fades up as the day's figures land. Reanimated's layout
        // animations follow the system's reduce-motion setting on their
        // own, so this needs no guard of its own.
        <Animated.View entering={FadeIn.duration(280)}>
          <DayPlate
            segments={segments}
            targetKcal={targets.caloriesKcal}
            onSelect={() => {
              // Selection is handled inside the dial; this only marks it as
              // interactive, which changes how it is exposed to a screen
              // reader.
            }}
          />
        </Animated.View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm }}>
          <AnimatedNumber
            value={Math.round(totals.nutrients.caloriesKcal)}
            variant="metricXL"
          />
          <Text variant="footnote" color="textMuted">
            {progress.calories.target !== null
              ? `of ${progress.calories.target} kcal`
              : 'kcal'}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: theme.spacing.base }}>
        {MACROS.map((macro) => {
          const grams = totals.nutrients[macro.grams];
          const target = macro.key === 'protein' ? proteinTarget : null;
          return (
            <View key={macro.key} style={{ flex: 1, gap: 5 }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: theme.colors[macro.color],
                  }}
                />
                <Text variant="caption" color="textMuted">
                  {macro.label}
                </Text>
              </View>
              <Text variant="metricM">
                <AnimatedNumber
                  value={grams < 10 ? Number(grams.toFixed(1)) : Math.round(grams)}
                  decimals={grams < 10 ? 1 : 0}
                  variant="metricM"
                />
                <Text variant="caption" color="textMuted">
                  {target !== null ? ` / ${target} g` : ' g'}
                </Text>
              </Text>
            </View>
          );
        })}
      </View>

      {containsEstimates || incompleteNote ? (
        <Disclosure
          summary={
            containsEstimates
              ? 'Includes AI estimates from photos'
              : 'Some totals are incomplete'
          }
          detail={
            [
              containsEstimates
                ? 'Part of this total comes from photo analysis, which is an estimate and not a measurement. Open a meal to see which items, and correct anything that looks wrong.'
                : null,
              incompleteNote,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          tone="caution"
        />
      ) : null}
    </Surface>
  );
}

/**
 * The overview while the day is still loading.
 *
 * Shaped like what it stands in for - a dial above three columns - so the
 * layout does not jump when the real figures land. A row of grey bars
 * standing in for a circle is how a loading state draws attention to itself.
 */
export function DayOverviewSkeleton({
  variant = 'full',
}: {
  variant?: 'full' | 'compact';
}) {
  const theme = useTheme();
  const size = 224;

  return (
    <Surface
      variant="raised"
      padding="lg"
      style={{ gap: variant === 'full' ? theme.spacing.lg : theme.spacing.base }}
    >
      <Skeleton width="28%" height={11} />
      {variant === 'full' ? (
        <Skeleton
          width={size}
          height={size}
          radius={size / 2}
          style={{ alignSelf: 'center' }}
        />
      ) : (
        <Skeleton width="45%" height={44} />
      )}
      <View style={{ flexDirection: 'row', gap: theme.spacing.base }}>
        {[0, 1, 2].map((column) => (
          <View key={column} style={{ flex: 1, gap: 7 }}>
            <Skeleton width="62%" height={10} />
            <Skeleton width="45%" height={17} />
          </View>
        ))}
      </View>
    </Surface>
  );
}
