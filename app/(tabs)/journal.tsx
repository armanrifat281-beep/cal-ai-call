import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { DailySummaryCard, EntryRow } from '@/components/nutrition';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useDayJournal } from '@/features/journal';
import { formatDayLabel, addDaysToKey, todayKey } from '@/lib/date';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import { MEAL_TYPES, type MealType } from '@/types/domain';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export default function JournalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const today = todayKey();
  const [dateKey, setDateKey] = useState(today);

  const targets = usePreferencesStore((state) => state.preferences.dailyTargets);
  const { entries, summary, loading, error, reload } = useDayJournal(dateKey);

  const isToday = dateKey === today;

  return (
    <Screen
      edges={{ top: true }}
      refreshing={loading}
      onRefresh={reload}
      contentStyle={{ gap: theme.spacing.lg }}
    >
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="title">Food journal</Text>

        <Card variant="soft" padding="sm">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <IconButton
              accessibilityLabel="Previous day"
              onPress={() => setDateKey((key) => addDaysToKey(key, -1))}
            >
              <Icon name="chevronLeft" size={20} color="text" />
            </IconButton>

            <View style={{ alignItems: 'center', gap: theme.spacing.xxs }}>
              <Text variant="bodyStrong">{formatDayLabel(dateKey)}</Text>
              <Text variant="caption" color="textMuted">
                {entries.length} meal{entries.length === 1 ? '' : 's'} logged
              </Text>
            </View>

            <IconButton
              accessibilityLabel="Next day"
              onPress={() => setDateKey((key) => addDaysToKey(key, 1))}
              // A journal of the future would be empty by definition.
              disabled={isToday}
            >
              <Icon name="chevronRight" size={20} color={isToday ? 'textMuted' : 'text'} />
            </IconButton>
          </View>
        </Card>

        {!isToday ? (
          <Button
            label="Back to today"
            variant="ghost"
            size="sm"
            onPress={() => setDateKey(today)}
          />
        ) : null}
      </View>

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? reload : undefined}
        />
      ) : loading && entries.length === 0 ? (
        <Skeleton height={180} radius={theme.radius.lg} />
      ) : (
        <DailySummaryCard
          totals={summary.totals}
          targets={targets}
          containsEstimates={summary.containsEstimates}
          dayLabel={formatDayLabel(dateKey)}
        />
      )}

      {entries.length === 0 && !loading ? (
        <Card variant="soft" padding="none">
          <EmptyState
            title={isToday ? 'Nothing logged today' : `Nothing logged on ${formatDayLabel(dateKey)}`}
            body="Add a meal by hand, or scan one from the Home tab."
            illustration={<Icon name="journal" size={44} color="primary" />}
            actionLabel="Add a meal"
            onAction={() => router.push('/entry/new')}
          />
        </Card>
      ) : (
        <View style={{ gap: theme.spacing.lg }}>
          {MEAL_TYPES.map((mealType) => {
            const forMeal = entries.filter((entry) => entry.mealType === mealType);
            const mealTotals = summary.byMealType[mealType];

            return (
              <View key={mealType} style={{ gap: theme.spacing.sm }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text variant="heading">{MEAL_LABELS[mealType]}</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                    }}
                  >
                    {forMeal.length > 0 ? (
                      <Text variant="bodySmStrong" color="textMuted">
                        {Math.round(mealTotals.nutrients.caloriesKcal)} kcal
                      </Text>
                    ) : null}
                    <IconButton
                      accessibilityLabel={`Add a ${MEAL_LABELS[mealType].toLowerCase()} entry`}
                      onPress={() => router.push(`/entry/new?mealType=${mealType}`)}
                      variant="soft"
                    >
                      <Icon name="plus" size={18} color="text" />
                    </IconButton>
                  </View>
                </View>

                {forMeal.length === 0 ? (
                  <Text variant="bodySm" color="textMuted">
                    Nothing here yet.
                  </Text>
                ) : (
                  forMeal.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      onPress={() => router.push(`/entry/${entry.id}`)}
                    />
                  ))
                )}
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
