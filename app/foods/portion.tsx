import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { SourceBadge } from '@/components/nutrition';
import {
  Button,
  ErrorState,
  Metric,
  Screen,
  SegmentedControl,
  Stepper,
  Surface,
  Text,
} from '@/components/ui';
import { addFoodToDay, DEFAULT_GRAMS } from '@/features/foods';
import { useJournalRepository } from '@/features/journal';
import { mealTypeForHour } from '@/features/journal/MealEditor';
import { scaleNutrientsByGrams } from '@/features/nutrition';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type FoodRecord,
  type MealType,
} from '@/types/domain';

/**
 * How much of this food, and which meal.
 *
 * Tapping a search result used to open the full meal editor. That editor is
 * for building a meal out of several foods; someone who has just tapped a
 * banana is answering a much smaller question, and landing in a form with a
 * title, a time, a notes field and an item list gave no sign that their
 * banana was even in there. "I don't understand what this does" was the
 * honest response to it.
 *
 * So this asks the two things that are actually unknown - how much, and
 * which meal - shows the numbers change as the amount does, and goes back
 * to the search so the next food can be added. The meal editor is still
 * there for anything more involved.
 */
const STEP_G = 10;
const MAX_G = 2000;

export default function PortionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const repository = useJournalRepository();
  const params = useLocalSearchParams<{ food?: string }>();

  const record = useMemo<FoodRecord | null>(() => {
    if (params.food === undefined) return null;
    try {
      return JSON.parse(params.food) as FoodRecord;
    } catch {
      return null;
    }
  }, [params.food]);

  const [grams, setGrams] = useState(DEFAULT_GRAMS);
  const [mealType, setMealType] = useState<MealType>(
    mealTypeForHour(new Date().getHours()),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  if (record === null) {
    return (
      <Screen title="Add a food">
        <ErrorState
          message="That food could not be opened. Search for it again."
          onRetry={() => router.back()}
          retryLabel="Back to search"
        />
      </Screen>
    );
  }

  // Recomputed as the amount changes, so the figures on screen are always
  // the figures that will be saved.
  const nutrients = scaleNutrientsByGrams(record.nutrientsPer100g, grams);

  const add = async () => {
    setSaving(true);
    setError(null);
    const result = await addFoodToDay(repository, record, grams, mealType);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Back to the search, not to the journal: someone adding one food is
    // usually adding several.
    router.back();
  };

  return (
    <Screen
      title={record.name}
      subtitle={record.brand ?? undefined}
      edges={{ bottom: true }}
      footer={
        <Button
          label={`Add to ${MEAL_TYPE_LABELS[mealType].toLowerCase()}`}
          onPress={() => void add()}
          loading={saving}
          size="lg"
          fullWidth
          haptic
        />
      }
    >
      {error ? <ErrorState message={error.message} detail={error.detail} /> : null}

      <Surface variant="raised" padding="lg" style={{ gap: theme.spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: theme.spacing.lg,
          }}
        >
          <Metric
            value={String(Math.round(nutrients.caloriesKcal))}
            label="KCAL"
            size="xl"
          />
          <View style={{ flexGrow: 1, flexDirection: 'row', gap: theme.spacing.base }}>
            <Metric value={`${Math.round(nutrients.proteinG)} g`} label="Protein" />
            <Metric value={`${Math.round(nutrients.carbsG)} g`} label="Carbs" />
            <Metric value={`${Math.round(nutrients.fatG)} g`} label="Fat" />
          </View>
        </View>

        <SourceBadge source="database" confidence="high" />
      </Surface>

      <Stepper
        label="Amount"
        unitLabel="g"
        value={grams}
        onChange={setGrams}
        min={STEP_G}
        max={MAX_G}
        step={STEP_G}
      />

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textMuted">
          WHICH MEAL
        </Text>
        <SegmentedControl
          options={MEAL_TYPES.map((type) => ({
            value: type,
            label: MEAL_TYPE_LABELS[type],
          }))}
          value={mealType}
          onChange={setMealType}
          accessibilityLabel="Which meal"
        />
      </View>

      <Text variant="caption" color="textSubtle">
        It joins today&apos;s {MEAL_TYPE_LABELS[mealType].toLowerCase()} if you
        have one, or starts it. You can change the amount afterwards from the
        journal.
      </Text>
    </Screen>
  );
}
