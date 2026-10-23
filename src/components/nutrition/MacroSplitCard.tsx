import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { PressableScale, Text } from '@/components/ui';
import { macroSplit } from '@/features/nutrition';
import { useTheme, type ColorKey } from '@/theme';
import type { Nutrients } from '@/types/domain';

export interface MacroSplitCardProps {
  totals: Nutrients;
  /** Opens the fuller breakdown. */
  onViewDetails?: () => void;
}

const SIZE = 78;
const THICKNESS = 13;
const RADIUS = (SIZE - THICKNESS) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Where today's energy came from, as a share rather than a count.
 *
 * Deliberately a different question from the macro tiles on the dial card.
 * Those ask "how much protein have I had against my target"; this asks "what
 * shape was the day" - 40% carbs is a fact about the balance of what was
 * eaten, and it is true whether or not any target exists. That is why this
 * card survives on a profile with no goals set, where the tiles above it are
 * three empty tracks.
 *
 * Shares are of ENERGY, not of weight. A gram of fat carries more than twice
 * the calories of a gram of carbohydrate, so splitting by weight would make
 * every meal look low in fat.
 */
export function MacroSplitCard({ totals, onViewDetails }: MacroSplitCardProps) {
  const theme = useTheme();
  const split = macroSplit(totals);

  const slices: { key: ColorKey & ('protein' | 'carbs' | 'fat'); label: string; share: number }[] = [
    { key: 'protein', label: 'Protein', share: split.proteinShare },
    { key: 'carbs', label: 'Carbs', share: split.carbsShare },
    { key: 'fat', label: 'Fat', share: split.fatShare },
  ];

  // False until something has been logged: three shares of nothing are not
  // three zeroes, they are an unanswered question.
  const known = split.hasData;

  // Each arc starts where the previous one ended, walking the circle once.
  let travelled = 0;

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.base,
        gap: theme.spacing.md,
      }}
    >
      <Text variant="callout" color="textMuted">
        Macro split
      </Text>

      {/*
        The donut sits above the legend, not beside it. This card is one half
        of a two-card row, so it is about 175pt wide on a phone: the donut and
        a gap take 94 of that, and "31%" takes most of what is left. Beside
        the chart, "Protein" was given almost no width - and text with no room
        does not clip, it wraps, one letter per line, into a tall column.
      */}
      <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
        <Svg
          width={SIZE}
          height={SIZE}
          accessibilityLabel={
            known
              ? slices
                  .map((slice) => `${slice.label} ${Math.round(slice.share * 100)}%`)
                  .join(', ')
              : 'Nothing logged yet'
          }
        >
          {/* The empty track, so a day with nothing on it is still a ring. */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={theme.colors.surfaceAlt}
            strokeWidth={THICKNESS}
            fill="none"
          />
          {known
            ? slices.map((slice) => {
                const dash = slice.share * CIRCUMFERENCE;
                const offset = -travelled * CIRCUMFERENCE;
                travelled += slice.share;

                return (
                  <Circle
                    key={slice.key}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    stroke={theme.colors[slice.key]}
                    strokeWidth={THICKNESS}
                    fill="none"
                    strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                    strokeDashoffset={offset}
                    // Twelve o'clock, which is where a dial is read from.
                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                  />
                );
              })
            : null}
        </Svg>

        <View style={{ alignSelf: 'stretch', gap: 7 }}>
          {slices.map((slice) => (
            <View
              key={slice.key}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.colors[slice.key],
                }}
              />
              <Text
                variant="caption"
                color="textMuted"
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {slice.label}
              </Text>
              <Text variant="metricS" style={{ flexShrink: 0 }}>
                {known ? `${Math.round(slice.share * 100)}%` : '—'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {onViewDetails ? (
        <PressableScale
          onPress={onViewDetails}
          accessibilityRole="button"
          accessibilityLabel="View the full nutrition breakdown"
          style={{
            alignItems: 'center',
            paddingVertical: 10,
            borderRadius: theme.radius.control,
            backgroundColor: theme.colors.surfaceAlt,
          }}
        >
          <Text variant="caption" style={{ fontWeight: '600' }}>
            View details
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
