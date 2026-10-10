import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  DayOverview,
  DayOverviewSkeleton,
  MealRow,
  WeekStrip,
  type WeekStripDay,
} from '@/components/nutrition';
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  Metric,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { computeEntryTotals } from '@/features/nutrition';
import { useDayJournal, useRangeJournal } from '@/features/journal';
import {
  addDaysToKey,
  formatDayLabel,
  groupByDateKey,
  lastSevenDayKeys,
  todayKey,
} from '@/lib/date';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import { MEAL_TYPES, type MealType } from '@/types/domain';

/**
 * Section headings, which is why snacks are plural here while
 * `MEAL_TYPE_LABELS` names a single meal.
 */
const MEAL_SECTION_TITLES: Record<MealType, string> = {
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

  // The strip's window moves a week at a time; tapping a day inside it only
  // moves the selection, so the week you are comparing against stays put.
  const [stripEnd, setStripEnd] = useState(today);
  const weekKeys = useMemo(() => lastSevenDayKeys(stripEnd), [stripEnd]);

  const targets = usePreferencesStore((state) => state.preferences.dailyTargets);
  const { entries, summary, loading, error, reload } = useDayJournal(dateKey);

  const week = useRangeJournal(weekKeys[0] ?? stripEnd, stripEnd);
  const weekDays = useMemo<WeekStripDay[]>(() => {
    const byDay = groupByDateKey(week.entries, (entry) => entry.consumedAt);
    return weekKeys.map((key) => {
      const dayEntries = byDay.get(key) ?? [];
      return {
        dateKey: key,
        caloriesKcal: dayEntries.reduce(
          (sum, entry) => sum + computeEntryTotals(entry).nutrients.caloriesKcal,
          0,
        ),
        entryCount: dayEntries.length,
      };
    });
  }, [week.entries, weekKeys]);

  const isToday = dateKey === today;

  const shiftWeek = (days: number) => {
    const nextEnd = addDaysToKey(stripEnd, days);
    // Never past today: a journal of the future would be empty by definition.
    const clamped = nextEnd > today ? today : nextEnd;
    setStripEnd(clamped);
    setDateKey(clamped);
  };

  const goToToday = () => {
    setStripEnd(today);
    setDateKey(today);
  };

  return (
    <Screen
      title="Journal"
      edges={{ top: true }}
      refreshing={loading}
      onRefresh={reload}
      titleAction={
        !isToday ? (
          <Button label="Today" variant="tonal" size="sm" onPress={goToToday} />
        ) : undefined
      }
    >
      {/* The week: where you are, and what the week looked like. */}
      <View style={{ gap: theme.spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <IconButton
            accessibilityLabel="Previous week"
            onPress={() => shiftWeek(-7)}
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
            accessibilityLabel="Next week"
            onPress={() => shiftWeek(7)}
            // A journal of the future would be empty by definition.
            disabled={stripEnd === today}
            variant="soft"
          >
            <Icon
              name="chevronRight"
              size={19}
              color={stripEnd === today ? 'textSubtle' : 'text'}
            />
          </IconButton>
        </View>

        <WeekStrip
          days={weekDays}
          selectedKey={dateKey}
          onSelect={setDateKey}
          targetKcal={targets.caloriesKcal}
        />
      </View>

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? reload : undefined}
        />
      ) : loading && entries.length === 0 ? (
        <DayOverviewSkeleton variant="compact" />
      ) : (
        <DayOverview
          summary={summary}
          targets={targets}
          dayLabel={formatDayLabel(dateKey)}
          variant="compact"
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
              title={MEAL_SECTION_TITLES[mealType]}
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
