import { useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { fromDateKey } from '@/lib/date';
import { useTheme } from '@/theme';

import { layoutEnergyBars, type EnergyBarDay } from './EnergyBars';

export interface EnergyBarChartProps {
  days: readonly EnergyBarDay[];
  targetKcal: number | null;
  height?: number;
}

/**
 * Daily energy across a period.
 *
 * The one thing a list of written insights cannot do: show the shape of the
 * period, so a heavy weekend or a run of light days is visible rather than
 * described.
 *
 * A day with nothing logged draws a small mark on the baseline instead of a
 * bar of zero height. Those look identical at a glance, and they mean
 * opposite things - one is a day of fasting, the other is a day the user
 * forgot to open the app.
 */
export function EnergyBarChart({ days, targetKcal, height = 120 }: EnergyBarChartProps) {
  const theme = useTheme();
  const layout = useMemo(() => layoutEnergyBars(days, targetKcal), [days, targetKcal]);

  if (days.length === 0) return null;

  // Enough labels to orient, not one per bar: thirty dates will not fit.
  const labelEvery = Math.max(1, Math.ceil(days.length / 7));

  const summary =
    layout.averageKcal === null
      ? 'No days with anything logged in this period.'
      : `Daily energy over ${days.length} days. ${layout.daysWithData} ${
          layout.daysWithData === 1 ? 'day has' : 'days have'
        } meals logged, averaging ${Math.round(layout.averageKcal)} kilocalories.${
          targetKcal !== null && targetKcal > 0
            ? ` The target is ${Math.round(targetKcal)}.`
            : ''
        }`;

  return (
    <View style={{ gap: theme.spacing.sm }} accessible accessibilityLabel={summary}>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        {/* The target, drawn behind the bars so they read against it. */}
        {layout.targetFraction !== null ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: layout.targetFraction * height,
              height: theme.hairline,
              backgroundColor: theme.colors.borderStrong,
            }}
          />
        ) : null}

        {layout.bars.map((bar) => (
          <View key={bar.dateKey} style={{ flex: 1, justifyContent: 'flex-end' }}>
            {bar.hasData ? (
              <View
                style={{
                  height: Math.max(bar.fraction * height, 2),
                  borderRadius: 3,
                  backgroundColor: bar.isOverTarget
                    ? theme.colors.warning
                    : theme.colors.primary,
                }}
              />
            ) : (
              // Nothing logged: a baseline mark, not a bar of zero height.
              <View
                style={{
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: theme.colors.border,
                }}
              />
            )}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 3 }}>
        {layout.bars.map((bar, index) => (
          <View key={bar.dateKey} style={{ flex: 1, alignItems: 'center' }}>
            {index % labelEvery === 0 ? (
              <Text variant="caption" color="textSubtle" numberOfLines={1}>
                {fromDateKey(bar.dateKey).getDate()}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <Text variant="caption" color="textMuted">
          {layout.daysWithData} of {days.length} days logged
        </Text>
        {layout.averageKcal !== null ? (
          <Text variant="caption" color="textMuted">
            {/* Averaged over the logged days only, which the label says
                plainly: averaging across blank days would report a figure
                the user never ate. */}
            {Math.round(layout.averageKcal)} kcal average on those days
          </Text>
        ) : null}
      </View>
    </View>
  );
}
