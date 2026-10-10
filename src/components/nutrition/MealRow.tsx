import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PressableScale, Text } from '@/components/ui';
import { computeEntryTotals } from '@/features/nutrition';
import { formatTimeOfDay } from '@/lib/date';
import { useTheme } from '@/theme';
import type { FoodEntry } from '@/types/domain';

import { MacroBar } from './MacroBar';
import { aggregateSource } from './SourceBadge';

export interface MealRowProps {
  entry: FoodEntry;
  onPress?: () => void;
  /** Draws a hairline above. Set on every row except the first. */
  divided?: boolean;
  /** Hides the macro bar, for dense lists. */
  compact?: boolean;
}

/**
 * One logged meal in a list.
 *
 * A row, not a card. Earlier revisions gave every meal its own outlined box,
 * which turned a day's eating into a stack of identical rectangles. Here the
 * time sits in a fixed-width rail on the left so the column aligns down the
 * list, and the energy figure is right-aligned in tabular digits so the
 * numbers line up too. Those two alignments do the work an outline was doing.
 */
export function MealRow({ entry, onPress, divided = false, compact = false }: MealRowProps) {
  const theme = useTheme();
  const totals = computeEntryTotals(entry);
  const source = aggregateSource(entry.items.map((item) => item.provenance.source));
  const isEstimate = source === 'ai_estimate';

  const itemSummary = entry.items
    .slice(0, 3)
    .map((item) => item.name)
    .join(', ');
  const extra = Math.max(0, entry.items.length - 3);

  const body = (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
      }}
    >
      {/* Time rail: fixed width, so the column lines up down the list. */}
      <View style={{ width: 52, paddingTop: 2 }}>
        <Text variant="metricS" color="textMuted">
          {formatTimeOfDay(entry.consumedAt)}
        </Text>
      </View>

      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>
            {entry.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {/*
              An estimate is marked with a small dot rather than a pill. A row
              of coloured badges on every meal was noise; this is noticed
              once and then read as a property of the row.
            */}
            {isEstimate ? (
              <View
                accessibilityLabel="Includes an AI estimate"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.colors.warning,
                }}
              />
            ) : null}
            <Text variant="metricM">{Math.round(totals.nutrients.caloriesKcal)}</Text>
            <Text variant="caption" color="textMuted">
              kcal
            </Text>
          </View>
        </View>

        {itemSummary.length > 0 ? (
          <Text variant="footnote" color="textMuted" numberOfLines={1}>
            {itemSummary}
            {extra > 0 ? ` +${extra}` : ''}
          </Text>
        ) : null}

        {!compact ? (
          <MacroBar nutrients={totals.nutrients} showLegend={false} height={4} />
        ) : null}
      </View>

      {onPress ? (
        <View style={{ justifyContent: 'center' }}>
          <Icon name="chevronRight" size={16} color="textSubtle" />
        </View>
      ) : null}
    </View>
  );

  const divider = divided ? (
    <View
      style={{
        height: theme.hairline,
        backgroundColor: theme.colors.separator,
        marginLeft: 52 + theme.spacing.md,
      }}
    />
  ) : null;

  if (!onPress) {
    return (
      <View>
        {divider}
        {body}
      </View>
    );
  }

  return (
    <View>
      {divider}
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${entry.title}, ${Math.round(totals.nutrients.caloriesKcal)} kcal`}
        accessibilityHint="Opens this meal to view or edit it"
        scaleTo={0.99}
      >
        {body}
      </PressableScale>
    </View>
  );
}
