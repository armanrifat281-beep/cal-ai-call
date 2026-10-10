import { Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/ui';
import { computeEntryTotals, formatCalories } from '@/features/nutrition';
import { formatTimeOfDay } from '@/lib/date';
import { useTheme } from '@/theme';
import type { FoodEntry, MealType } from '@/types/domain';

import { MacroBar } from './MacroBar';
import { SourceBadge, aggregateSource } from './SourceBadge';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export interface EntryRowProps {
  entry: FoodEntry;
  onPress?: () => void;
  /** Hide the macro bar in dense lists. */
  compact?: boolean;
}

/** One logged meal, as it appears in the timeline and the journal. */
export function EntryRow({ entry, onPress, compact = false }: EntryRowProps) {
  const theme = useTheme();
  const totals = computeEntryTotals(entry);
  const source = aggregateSource(entry.items.map((item) => item.provenance.source));
  const lowestConfidence = entry.items.some((i) => i.provenance.confidence === 'low')
    ? 'low'
    : entry.items.some((i) => i.provenance.confidence === 'medium')
      ? 'medium'
      : 'high';

  const itemSummary = entry.items
    .slice(0, 3)
    .map((item) => item.name)
    .join(', ');
  const extraCount = Math.max(0, entry.items.length - 3);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${MEAL_LABELS[entry.mealType]}: ${entry.title}, ${formatCalories(
        totals.nutrients.caloriesKcal,
      )}`}
      accessibilityHint={onPress ? 'Opens this meal to view or edit it' : undefined}
      style={({ pressed }) => ({
        padding: theme.spacing.base,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface,
        gap: theme.spacing.sm,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="caption" color="textMuted">
          {MEAL_LABELS[entry.mealType].toUpperCase()}
        </Text>
        <Text variant="caption" color="textMuted">
          {formatTimeOfDay(entry.consumedAt)}
        </Text>
        <View style={{ flex: 1 }} />
        {onPress ? <Icon name="chevronRight" size={18} color="textMuted" /> : null}
      </View>

      <View
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text variant="subheading">{entry.title}</Text>
          {itemSummary.length > 0 ? (
            <Text variant="bodySm" color="textMuted" numberOfLines={2}>
              {itemSummary}
              {extraCount > 0 ? ` +${extraCount} more` : ''}
            </Text>
          ) : null}
        </View>
        <Text variant="metric">{formatCalories(totals.nutrients.caloriesKcal)}</Text>
      </View>

      {!compact ? <MacroBar nutrients={totals.nutrients} showLegend={false} height={6} /> : null}

      {source ? (
        <View style={{ flexDirection: 'row' }}>
          <SourceBadge source={source} confidence={lowestConfidence} />
        </View>
      ) : null}
    </Pressable>
  );
}
