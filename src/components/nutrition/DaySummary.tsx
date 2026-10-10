import { View } from 'react-native';

import { Disclosure, Metric, ProgressBar, Surface, Text } from '@/components/ui';
import {
  computeDailyProgress,
  describeIncompleteTotals,
  formatPercent,
  type NutrientSum,
} from '@/features/nutrition';
import { useTheme } from '@/theme';
import type { DailyTargets } from '@/types/domain';

import { MacroBar } from './MacroBar';

export interface DaySummaryProps {
  totals: NutrientSum;
  targets: DailyTargets;
  /** True when any contributing item was a model estimate. */
  containsEstimates: boolean;
  /** Shown as the eyebrow, e.g. "Today". */
  dayLabel: string;
}

/**
 * The day's headline figure.
 *
 * The one raised surface on the Home screen, so the eye lands here first.
 * Restrained on purpose: a single energy number, the macro split, and a
 * target line only when the user actually set a target. No rings, no streak
 * counter, no precision the data does not support.
 */
export function DaySummary({
  totals,
  targets,
  containsEstimates,
  dayLabel,
}: DaySummaryProps) {
  const theme = useTheme();
  const progress = computeDailyProgress(totals.nutrients, targets);
  const incompleteNote = describeIncompleteTotals(totals.incompleteKeys);
  const hasTarget = progress.calories.target !== null;

  return (
    <Surface variant="raised" padding="lg" style={{ gap: theme.spacing.base }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <Metric
          value={String(Math.round(totals.nutrients.caloriesKcal))}
          unit="kcal"
          label={dayLabel}
          labelPosition="above"
          size="xl"
        />

        {hasTarget ? (
          <Metric
            value={formatPercent(progress.calories.ratio)}
            label={`of ${progress.calories.target}`}
            labelPosition="above"
            size="m"
            align="right"
            color={progress.calories.isOver ? 'warningOnSoft' : 'primaryOnSoft'}
          />
        ) : null}
      </View>

      {hasTarget ? (
        <ProgressBar
          value={progress.calories.ratio ?? 0}
          color={progress.calories.isOver ? 'warning' : 'primary'}
          height={5}
          accessibilityLabel={`Energy: ${formatPercent(progress.calories.ratio)} of your target`}
        />
      ) : null}

      <MacroBar nutrients={totals.nutrients} />

      {progress.protein.target !== null ? (
        <View style={{ gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" color="textMuted">
              Protein target
            </Text>
            <Text variant="metricS" color="textMuted">
              {Math.round(progress.protein.consumed)} / {progress.protein.target} g
            </Text>
          </View>
          <ProgressBar
            value={progress.protein.ratio ?? 0}
            color="protein"
            height={4}
            accessibilityLabel={`Protein: ${formatPercent(progress.protein.ratio)} of your target`}
          />
        </View>
      ) : null}

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
