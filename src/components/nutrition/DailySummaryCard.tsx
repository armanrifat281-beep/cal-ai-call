import { View } from 'react-native';

import { Card, InfoNote, ProgressBar, Text } from '@/components/ui';
import {
  computeDailyProgress,
  describeIncompleteTotals,
  formatCalories,
  formatPercent,
  type NutrientSum,
} from '@/features/nutrition';
import { useTheme } from '@/theme';
import type { DailyTargets } from '@/types/domain';

import { MacroBar } from './MacroBar';

export interface DailySummaryCardProps {
  totals: NutrientSum;
  targets: DailyTargets;
  /** True when any contributing item was a model estimate. */
  containsEstimates: boolean;
  /** Shown as the card heading, e.g. "Today" or "Mon 6 Oct". */
  dayLabel: string;
}

/**
 * The day's headline numbers.
 *
 * Deliberately restrained: one energy figure, one macro bar, and a target line
 * only when the user actually set a target. No rings, no streak counters, and
 * no precision we do not have.
 */
export function DailySummaryCard({
  totals,
  targets,
  containsEstimates,
  dayLabel,
}: DailySummaryCardProps) {
  const theme = useTheme();
  const progress = computeDailyProgress(totals.nutrients, targets);
  const incompleteNote = describeIncompleteTotals(totals.incompleteKeys);

  return (
    <Card padding="lg" style={{ gap: theme.spacing.base }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="caption" color="textMuted">
            {dayLabel.toUpperCase()}
          </Text>
          <Text variant="display">{formatCalories(totals.nutrients.caloriesKcal)}</Text>
        </View>

        {progress.calories.target !== null ? (
          <View style={{ alignItems: 'flex-end', gap: theme.spacing.xxs }}>
            <Text variant="caption" color="textMuted">
              OF {progress.calories.target} KCAL
            </Text>
            <Text
              variant="metricSm"
              color={progress.calories.isOver ? 'warningOnSoft' : 'primaryOnSoft'}
            >
              {formatPercent(progress.calories.ratio)}
            </Text>
          </View>
        ) : null}
      </View>

      {progress.calories.target !== null ? (
        <ProgressBar
          value={progress.calories.ratio ?? 0}
          color={progress.calories.isOver ? 'warning' : 'primary'}
          accessibilityLabel={`Calories: ${formatPercent(progress.calories.ratio)} of your target`}
        />
      ) : null}

      <MacroBar nutrients={totals.nutrients} />

      {progress.protein.target !== null ? (
        <View style={{ gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" color="textMuted">
              PROTEIN TARGET
            </Text>
            <Text variant="caption">
              {Math.round(progress.protein.consumed)} / {progress.protein.target} g
            </Text>
          </View>
          <ProgressBar
            value={progress.protein.ratio ?? 0}
            color="protein"
            height={6}
            accessibilityLabel={`Protein: ${formatPercent(progress.protein.ratio)} of your target`}
          />
        </View>
      ) : null}

      {containsEstimates ? (
        <InfoNote
          body="This total includes AI estimates from photos. Treat it as a rough figure, not a measurement."
          tone="warning"
        />
      ) : null}

      {incompleteNote ? <InfoNote body={incompleteNote} tone="neutral" /> : null}
    </Card>
  );
}
