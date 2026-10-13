import { useState } from 'react';
import { View } from 'react-native';

import { ErrorState, PressableScale, Surface, Text } from '@/components/ui';
import { sumNutrients } from '@/features/nutrition';
import { fromDateKey, todayKey, type DateKey } from '@/lib/date';
import { useTheme } from '@/theme';
import type { AppError } from '@/lib/result';
import type { SavedMeal } from '@/types/domain';

import { useJournalRepository, useSavedMeals } from './hooks';

/** Enough to be useful, few enough not to bury the day itself. */
const MAX_SHOWN = 6;

/**
 * Meals the user saved, ready to log again in one tap.
 *
 * The thing that decides whether a food journal survives contact with real
 * life: most people eat the same ten breakfasts, and retyping one of them
 * every morning is what makes people stop logging by the second week.
 *
 * Deliberately hidden until something has been saved. An empty "quick add"
 * rail on a new account would be a promise the app has not earned yet, and
 * filling it with examples would be inventing meals the user never ate.
 *
 * Provenance travels with the items unchanged: a breakfast whose figures were
 * a model's estimate is still an estimate the second time it is logged, so
 * re-logging it never quietly upgrades a guess into a measurement.
 */
export interface QuickAddMealsProps {
  /** The day being viewed. A meal added here lands on that day, not today. */
  dateKey: DateKey;
  /** Called after a successful add, so the day's totals refresh. */
  onAdded: () => void;
  /**
   * Say how to fill this when nothing has been saved yet.
   *
   * Set on a day that has meals on it. Without it the whole card stayed
   * hidden until a meal happened to be saved, which made a feature nobody
   * could find: there was nothing on the screen to say it existed, or that
   * opening a meal was how to start.
   *
   * Left off on an empty day, where the day's own empty state is already
   * telling the user to add a meal and a second prompt would just compete
   * with it.
   */
  hintWhenEmpty?: boolean;
}

/**
 * When on `dateKey` to record the meal.
 *
 * Today keeps the real time. Another day has no true time, so midday is used:
 * it sits inside that local day whatever the timezone does around midnight,
 * where an instant near 00:00 can land on the day before.
 */
function instantOnDay(dateKey: DateKey): string {
  const now = new Date();
  if (todayKey(now) === dateKey) return now.toISOString();

  const day = fromDateKey(dateKey);
  day.setHours(12, 0, 0, 0);
  return day.toISOString();
}

/** Most-used first; ties broken by whichever was used most recently. */
function byUsefulness(a: SavedMeal, b: SavedMeal): number {
  if (b.useCount !== a.useCount) return b.useCount - a.useCount;
  return (b.lastUsedAt ?? b.createdAt).localeCompare(a.lastUsedAt ?? a.createdAt);
}

export function QuickAddMeals({
  dateKey,
  onAdded,
  hintWhenEmpty = false,
}: QuickAddMealsProps) {
  const theme = useTheme();
  const repository = useJournalRepository();
  const { savedMeals, reload } = useSavedMeals();

  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  if (savedMeals.length === 0) {
    // Nothing saved yet. Say how to start, rather than showing an empty rail
    // of nothing or hiding the feature so thoroughly that it is never found.
    if (!hintWhenEmpty) return null;

    return (
      <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textMuted">
          QUICK ADD
        </Text>
        <Text variant="caption" color="textMuted">
          Open a meal below and choose “Save for quick add”. It will appear
          here, ready to log again in one tap.
        </Text>
      </Surface>
    );
  }

  const shown = [...savedMeals].sort(byUsefulness).slice(0, MAX_SHOWN);

  const add = async (meal: SavedMeal) => {
    setAddingId(meal.id);
    setError(null);

    const created = await repository.createEntry({
      consumedAt: instantOnDay(dateKey),
      // A meal saved without a meal type is logged as a snack rather than
      // being refused: the user asked for it to be added, not interrogated.
      mealType: meal.mealType ?? 'snack',
      title: meal.name,
      items: meal.items,
    });

    if (!created.ok) {
      setAddingId(null);
      setError(created.error);
      return;
    }

    // The entry is already saved, so a failure to bump the counter is not
    // worth telling the user about - it only affects this list's ordering.
    const counted = await repository.recordSavedMealUse(meal.id);
    if (counted.ok) reload();

    setAddingId(null);
    onAdded();
  };

  return (
    <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.md }}>
      <Text variant="label" color="textMuted">
        QUICK ADD
      </Text>

      {error ? <ErrorState message={error.message} detail={error.detail} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {shown.map((meal) => {
          const kcal = Math.round(
            sumNutrients(meal.items.map((item) => item.nutrients)).nutrients.caloriesKcal,
          );
          const busy = addingId === meal.id;

          return (
            <PressableScale
              key={meal.id}
              haptic
              disabled={addingId !== null}
              onPress={() => void add(meal)}
              accessibilityRole="button"
              accessibilityLabel={`Log ${meal.name}, ${kcal} calories, on ${dateKey}`}
              accessibilityState={{ busy, disabled: addingId !== null }}
              style={{
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.base,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.surfaceAlt,
                gap: 2,
              }}
            >
              <Text variant="footnote" style={{ fontWeight: '600' }}>
                {meal.name}
              </Text>
              <Text variant="caption" color="textMuted">
                {busy ? 'Adding…' : `${kcal} kcal`}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </Surface>
  );
}
