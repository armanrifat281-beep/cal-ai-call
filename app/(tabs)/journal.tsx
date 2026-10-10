import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { DaySummary, MealRow } from '@/components/nutrition';
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  Metric,
  Screen,
  Section,
  Skeleton,
  Surface,
  Text,
} from '@/components/ui';
import { useDayJournal } from '@/features/journal';
import { addDaysToKey, formatDayLabel, todayKey } from '@/lib/date';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import { MEAL_TYPES, type MealType } from '@/types/domain';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/**
 * The food journal, one day at a time.
 *
 * The day stepper sits directly under the title rather than in a boxed
 * control, and each meal type is a section heading with its energy total
 * right-aligned against it - so the page scans as a day's eating rather than
 * as four identical panels.
 */
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
      title="Journal"
      edges={{ top: true }}
      refreshing={loading}
      onRefresh={reload}
      titleAction={
        !isToday ? (
          <Button label="Today" variant="tonal" size="sm" onPress={() => setDateKey(today)} />
        ) : undefined
      }
    >
      {/* Day stepper. A row of controls, not a panel. */}
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
          variant="soft"
        >
          <Icon name="chevronLeft" size={19} color="text" />
        </IconButton>

        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text variant="headline">{formatDayLabel(dateKey)}</Text>
          <Text variant="caption" color="textMuted">
            {entries.length === 0
              ? 'Nothing logged'
              : `${entries.length} meal${entries.length === 1 ? '' : 's'}`}
          </Text>
        </View>

        <IconButton
          accessibilityLabel="Next day"
          onPress={() => setDateKey((key) => addDaysToKey(key, 1))}
          // A journal of the future would be empty by definition.
          disabled={isToday}
          variant="soft"
        >
          <Icon name="chevronRight" size={19} color={isToday ? 'textSubtle' : 'text'} />
        </IconButton>
      </View>

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? reload : undefined}
        />
      ) : loading && entries.length === 0 ? (
        <Surface variant="raised" padding="lg" style={{ gap: theme.spacing.base }}>
          <Skeleton width="30%" height={13} />
          <Skeleton width="55%" height={42} />
          <Skeleton height={6} radius={3} />
        </Surface>
      ) : (
        <DaySummary
          totals={summary.totals}
          targets={targets}
          containsEstimates={summary.containsEstimates}
          dayLabel={formatDayLabel(dateKey)}
        />
      )}

      {entries.length === 0 && !loading ? (
        <EmptyState
          title={isToday ? 'Nothing logged today' : `Nothing on ${formatDayLabel(dateKey)}`}
          body="Add a meal by hand, or photograph one from the Scan tab."
          illustration={<Icon name="journal" size={38} color="primary" strokeWidth={1.5} />}
          actionLabel="Add a meal"
          onAction={() => router.push('/entry/new')}
        />
      ) : (
        MEAL_TYPES.map((mealType) => {
          const forMeal = entries.filter((entry) => entry.mealType === mealType);
          const mealTotals = summary.byMealType[mealType];

          return (
            <Section
              key={mealType}
              title={MEAL_LABELS[mealType]}
              dense
              action={{
                label: 'Add',
                onPress: () => router.push(`/entry/new?mealType=${mealType}`),
              }}
            >
              {forMeal.length === 0 ? (
                <Text variant="footnote" color="textSubtle">
                  Nothing here yet.
                </Text>
              ) : (
                <View>
                  <Metric
                    value={String(Math.round(mealTotals.nutrients.caloriesKcal))}
                    unit="kcal"
                    size="s"
                    style={{ marginBottom: theme.spacing.xs }}
                  />
                  {forMeal.map((entry, index) => (
                    <MealRow
                      key={entry.id}
                      entry={entry}
                      divided={index > 0}
                      onPress={() => router.push(`/entry/${entry.id}`)}
                    />
                  ))}
                </View>
              )}
            </Section>
          );
        })
      )}
    </Screen>
  );
}
