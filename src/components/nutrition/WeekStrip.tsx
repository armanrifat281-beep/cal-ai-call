import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { annularSectorPath } from '@/components/charts';
import { PressableScale, Text } from '@/components/ui';
import { fromDateKey, todayKey, type DateKey } from '@/lib/date';
import { useTheme } from '@/theme';

export interface WeekStripDay {
  dateKey: DateKey;
  caloriesKcal: number;
  entryCount: number;
}

export interface WeekStripProps {
  days: readonly WeekStripDay[];
  selectedKey: DateKey;
  onSelect: (dateKey: DateKey) => void;
  /** A full ring is this many kilocalories. Null draws presence, not progress. */
  targetKcal: number | null;
}

const RING = 30;
const RING_THICKNESS = 4.5;

/**
 * Seven days, as navigation and as a chart at the same time.
 *
 * A pair of arrows and a date told you which day you were looking at and
 * nothing else. This says the same thing and also shows the shape of the
 * week, so a light day or a gap is visible before you tap anything - which
 * is the question a journal is usually opened to answer.
 *
 * Each ring is energy against the day's target, and nothing more. The full
 * dial splits a day into meals and macros, but twelve bands inside thirty
 * points is noise, not information, so the detail stays where it can be
 * read. With no target set there is nothing to be a fraction of, and a day
 * with anything logged draws a complete ring instead - presence, not
 * progress, which is all that can honestly be claimed.
 */
export function WeekStrip({ days, selectedKey, onSelect, targetKcal }: WeekStripProps) {
  const theme = useTheme();
  const today = todayKey();

  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', justifyContent: 'space-between' }}
    >
      {days.map((day) => {
        const isSelected = day.dateKey === selectedKey;
        const isToday = day.dateKey === today;
        const date = fromDateKey(day.dateKey);

        const fraction =
          targetKcal !== null && targetKcal > 0
            ? Math.min(day.caloriesKcal / targetKcal, 1)
            : day.entryCount > 0
              ? 1
              : 0;
        const isOver = targetKcal !== null && targetKcal > 0 && day.caloriesKcal > targetKcal;

        const weekday = date.toLocaleDateString(undefined, { weekday: 'narrow' });
        const dayOfMonth = date.getDate();

        const outer = RING / 2;
        const inner = outer - RING_THICKNESS;
        const arc =
          fraction > 0
            ? annularSectorPath({
                cx: outer,
                cy: outer,
                innerRadius: inner,
                outerRadius: outer,
                startAngle: 0,
                endAngle: fraction * 360,
              })
            : '';

        return (
          <PressableScale
            key={day.dateKey}
            onPress={() => onSelect(day.dateKey)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${date.toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}, ${
              day.entryCount === 0
                ? 'nothing logged'
                : `${Math.round(day.caloriesKcal)} kilocalories`
            }`}
            scaleTo={0.94}
            style={{
              alignItems: 'center',
              gap: 5,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: 2,
              borderRadius: theme.radius.control,
              flex: 1,
              backgroundColor: isSelected ? theme.colors.surfaceAlt : 'transparent',
            }}
          >
            <Text
              variant="caption"
              color={isSelected ? 'text' : 'textSubtle'}
              numberOfLines={1}
            >
              {weekday}
            </Text>

            <View style={{ width: RING, height: RING }}>
              <Svg width={RING} height={RING}>
                <Circle
                  cx={outer}
                  cy={outer}
                  r={outer - RING_THICKNESS / 2}
                  stroke={isSelected ? theme.colors.surface : theme.colors.surfaceAlt}
                  strokeWidth={RING_THICKNESS}
                  fill="none"
                />
                {arc ? (
                  <Path d={arc} fill={isOver ? theme.colors.warning : theme.colors.primary} />
                ) : null}
              </Svg>

              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  variant="caption"
                  color={day.entryCount > 0 ? 'text' : 'textSubtle'}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {dayOfMonth}
                </Text>
              </View>
            </View>

            {/* Today keeps a mark of its own, so it stays findable once the
                selection has moved somewhere else in the week. */}
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: isToday ? theme.colors.primary : 'transparent',
              }}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}
