import { View } from 'react-native';

import { ProgressRing } from '@/components/charts';
import { AnimatedNumber, Surface, Text } from '@/components/ui';
import type { DaySummary } from '@/features/nutrition';
import { useTheme } from '@/theme';
import type { DailyTargets } from '@/types/domain';

export interface DayDashboardProps {
  summary: DaySummary;
  targets: DailyTargets;
  /** The eyebrow, e.g. "Today". */
  dayLabel: string;
}

interface MacroSpec {
  key: 'protein' | 'carbs' | 'fat';
  label: string;
  eaten: number;
  target: number | null;
  color: string;
}

/**
 * The day, at a glance.
 *
 * One figure the page is built around, then the three that explain it.
 * Home used to open with nine cards of equal weight - a week strip, quick
 * actions, an overview, a confidence bar, water, weight, other nutrients -
 * which gave the eye no answer to "am I alright today". This gives that
 * answer in the first screenful and leaves everything else below it.
 *
 * It leads with what is LEFT rather than what was eaten. "1,250 eaten" is a
 * fact about the past; "1,250 left" is the thing a decision about dinner
 * actually turns on. Past the target it switches to "over", because a
 * negative number of calories left is not a thing anyone reads correctly.
 *
 * With no target set it shows the plain total instead, and no ring: a ring
 * against nothing is a circle.
 */
export function DayDashboard({ summary, targets, dayLabel }: DayDashboardProps) {
  const theme = useTheme();

  const eaten = summary.totals.nutrients.caloriesKcal;
  const target = targets.caloriesKcal;
  const remaining = target === null ? null : Math.round(target - eaten);
  const over = remaining !== null && remaining < 0;

  const macros: MacroSpec[] = [
    {
      key: 'protein',
      label: 'Protein',
      eaten: summary.totals.nutrients.proteinG,
      target: targets.proteinG,
      color: theme.colors.protein,
    },
    {
      key: 'carbs',
      label: 'Carbs',
      eaten: summary.totals.nutrients.carbsG,
      target: targets.carbsG,
      color: theme.colors.carbs,
    },
    {
      key: 'fat',
      label: 'Fat',
      eaten: summary.totals.nutrients.fatG,
      target: targets.fatG,
      color: theme.colors.fat,
    },
  ];

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Surface variant="raised" padding="lg">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.base,
          }}
        >
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="label" color="textMuted">
              {dayLabel.toUpperCase()}
            </Text>

            <AnimatedNumber
              value={remaining === null ? eaten : Math.abs(remaining)}
              variant="display"
              style={{ fontSize: 44, lineHeight: 48, letterSpacing: -1.6 }}
            />

            <Text variant="footnote" color="textMuted">
              {target === null
                ? 'kcal eaten — set a goal to track what is left'
                : over
                  ? 'kcal over your goal'
                  : 'kcal left today'}
            </Text>
          </View>

          {target === null ? null : (
            <ProgressRing
              progress={target > 0 ? eaten / target : 0}
              size={104}
              // Over the goal the ring changes colour rather than resetting:
              // the arc is full either way, so colour is what carries it.
              color={over ? theme.colors.warning : theme.colors.primary}
              accessibilityLabel={`${Math.round(eaten)} of ${Math.round(target)} calories, ${
                over ? `${Math.abs(remaining)} over` : `${remaining} left`
              }`}
            >
              <Text variant="footnote" style={{ fontWeight: '700' }}>
                {`${Math.round(target > 0 ? (eaten / target) * 100 : 0)}%`}
              </Text>
            </ProgressRing>
          )}
        </View>
      </Surface>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        {macros.map((macro) => (
          <Surface
            key={macro.key}
            variant="raised"
            padding="base"
            style={{ flex: 1, alignItems: 'center', gap: theme.spacing.sm }}
          >
            <ProgressRing
              progress={macro.target && macro.target > 0 ? macro.eaten / macro.target : 0}
              size={58}
              thickness={6}
              color={macro.color}
              accessibilityLabel={
                macro.target === null
                  ? `${macro.label}: ${Math.round(macro.eaten)} grams`
                  : `${macro.label}: ${Math.round(macro.eaten)} of ${Math.round(macro.target)} grams`
              }
            >
              <Text variant="caption" style={{ fontWeight: '700' }}>
                {`${Math.round(macro.eaten)}g`}
              </Text>
            </ProgressRing>

            <View style={{ alignItems: 'center' }}>
              <Text variant="caption" color="textMuted">
                {macro.label}
              </Text>
              {/*
                The target, not the amount left: a macro left over is not a
                decision anyone makes, where "of 120g" says how far along the
                day is without a second number to subtract.
              */}
              {macro.target === null ? null : (
                <Text variant="caption" color="textSubtle">
                  {`of ${Math.round(macro.target)}g`}
                </Text>
              )}
            </View>
          </Surface>
        ))}
      </View>
    </View>
  );
}
