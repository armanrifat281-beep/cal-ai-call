import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { CharacteristicList } from '@/components/nutrition';
import {
  Button,
  ErrorState,
  PressableScale,
  Screen,
  SegmentedControl,
  Text,
} from '@/components/ui';
import { addFoodToDay, DEFAULT_GRAMS } from '@/features/foods';
import { useJournalRepository } from '@/features/journal';
import { mealTypeForHour } from '@/features/journal/MealEditor';
import {
  dailyValueFor,
  describeNutrients,
  scaleNutrientsByGrams,
  scoreNutrients,
  type DailyValueKey,
} from '@/features/nutrition';
import type { AppError } from '@/lib/result';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme, type ColorKey } from '@/theme';
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type FoodRecord,
  type MealType,
  type Nutrients,
} from '@/types/domain';

/**
 * How much of this food, and which meal.
 *
 * Tapping a search result used to open the full meal editor. That editor is
 * for building a meal out of several foods; someone who has just tapped a
 * banana is answering a much smaller question, and landing in a form with a
 * title, a time, a notes field and an item list gave no sign that their
 * banana was even in there.
 *
 * So this asks the two things that are actually unknown - how much, and
 * which meal - and spends the rest of the screen on what the database knows
 * about the food, scaled live to the amount chosen. Every figure on it is
 * the figure that will be saved.
 */

/** How much one press of the stepper changes the amount. */
const STEP_G = 10;
const MAX_G = 2000;

export default function PortionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const repository = useJournalRepository();
  const params = useLocalSearchParams<{ food?: string }>();
  const targets = usePreferencesStore((state) => state.preferences.dailyTargets);

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
  const score = scoreNutrients(nutrients);
  const characteristics = describeNutrients(nutrients);

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
      edges={{ top: true, bottom: true }}
      contentStyle={{ gap: theme.spacing.lg }}
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
      <PressableScale
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back to search"
        hitSlop={12}
        scaleTo={0.9}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface,
        }}
      >
        <Icon name="chevronLeft" size={17} color="text" strokeWidth={2} />
      </PressableScale>

      {error ? <ErrorState message={error.message} detail={error.detail} /> : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.base,
        }}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="title1">{record.name}</Text>
          <Text variant="callout" color="textMuted">
            {[
              record.brand,
              `${grams} g`,
              // The whole reason this screen exists rather than an estimate:
              // these figures were looked up, not guessed.
              'verified',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        {/*
          The score out of a hundred, in a badge.

          Out of a hundred here and out of ten on a logged meal, deliberately:
          this is a food being compared with other foods, where a finer scale
          is useful, and that is a different act from reading back how a meal
          went.
        */}
        <View
          style={{
            alignItems: 'center',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: theme.radius.media,
            backgroundColor: theme.colors.primarySoft,
          }}
          accessibilityLabel={
            score.outOfHundred === null
              ? 'Not enough detail to score this food'
              : `Scores ${score.outOfHundred} out of 100`
          }
        >
          <Text variant="metricL" color="primary" style={{ fontSize: 20 }}>
            {score.outOfHundred ?? '—'}
          </Text>
          <Text
            variant="caption"
            color="primaryOnSoft"
            style={{ fontSize: 9, letterSpacing: 0.8 }}
          >
            SCORE
          </Text>
        </View>
      </View>

      {/* How much. The one question the user is here to answer. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: theme.spacing.base,
          borderRadius: 20,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Text variant="headline" style={{ fontSize: 15 }}>
          Amount
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.base }}>
          <AmountButton
            direction={-1}
            disabled={grams <= STEP_G}
            onPress={() => setGrams(Math.max(STEP_G, grams - STEP_G))}
          />
          <Text variant="metricM" style={{ minWidth: 56, textAlign: 'center' }}>
            {grams} g
          </Text>
          <AmountButton
            direction={1}
            disabled={grams >= MAX_G}
            onPress={() => setGrams(Math.min(MAX_G, grams + STEP_G))}
          />
        </View>
      </View>

      {/* The energy, and what carries it. */}
      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.base,
          padding: theme.spacing.base,
          borderRadius: 20,
          backgroundColor: theme.colors.surface,
        }}
      >
        <View style={{ alignItems: 'center', gap: 2, minWidth: 74 }}>
          <Icon name="flame" size={20} color="accent" strokeWidth={1.8} />
          <Text variant="metricL" style={{ fontSize: 24 }}>
            {Math.round(nutrients.caloriesKcal)}
          </Text>
          <Text variant="caption" color="textSubtle">
            kcal
          </Text>
        </View>

        <View style={{ flex: 1, gap: theme.spacing.sm, justifyContent: 'center' }}>
          <MacroLine tone="protein" label="Protein" grams={nutrients.proteinG} of={nutrients} />
          <MacroLine tone="carbs" label="Carbs" grams={nutrients.carbsG} of={nutrients} />
          <MacroLine tone="fat" label="Fat" grams={nutrients.fatG} of={nutrients} />
          {nutrients.fiberG === null ? null : (
            <MacroLine tone="fiber" label="Fibre" grams={nutrients.fiberG} of={nutrients} />
          )}
        </View>
      </View>

      {/*
        Three figures people look for by name.

        Where the designs show a glycemic index. No nutrition database this
        app reads carries one - it is measured in a feeding study, not
        calculated from a label - so the slot holds saturated fat instead,
        which is on every label and is one of the five things the score is
        built from.
      */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <FactTile
          label="Saturates"
          value={nutrients.saturatedFatG}
          unit="g"
        />
        <FactTile label="Sugar" value={nutrients.sugarG} unit="g" />
        <FactTile label="Sodium" value={nutrients.sodiumMg} unit="mg" />
      </View>

      {characteristics.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="title2">Characteristics</Text>
          <CharacteristicList characteristics={characteristics} />
        </View>
      ) : null}

      {/*
        Where the designs show vitamins and minerals.

        The food databases this app reads do not return micronutrients, so
        rather than print a column of dashes under a promising heading, this
        is the same question asked of the figures that ARE known: how much of
        a day is in this portion.
      */}
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="title2">Share of a day</Text>

        <View style={{ gap: theme.spacing.md }}>
          <DailyValueRow nutrientKey="caloriesKcal" label="Calories" nutrients={nutrients} targets={targets} />
          <DailyValueRow nutrientKey="proteinG" label="Protein" nutrients={nutrients} targets={targets} />
          <DailyValueRow nutrientKey="carbsG" label="Carbs" nutrients={nutrients} targets={targets} />
          <DailyValueRow nutrientKey="fatG" label="Fat" nutrients={nutrients} targets={targets} />
          <DailyValueRow nutrientKey="fiberG" label="Fibre" nutrients={nutrients} targets={targets} />
          <DailyValueRow nutrientKey="sodiumMg" label="Sodium" nutrients={nutrients} targets={targets} />
        </View>

        <Text variant="caption" color="textSubtle">
          Against your own daily targets where you have set them, and the
          reference intake for an average adult everywhere else — the same
          table the percentages on a food packet use.
        </Text>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textMuted">
          Which meal
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
        <Text variant="caption" color="textSubtle">
          It joins today&apos;s {MEAL_TYPE_LABELS[mealType].toLowerCase()} if
          you have one, or starts it. The amount can be changed afterwards
          from the meal itself.
        </Text>
      </View>
    </Screen>
  );
}

function AmountButton({
  direction,
  disabled,
  onPress,
}: {
  direction: -1 | 1;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic
      accessibilityRole="button"
      accessibilityLabel={direction === 1 ? 'More' : 'Less'}
      scaleTo={0.88}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
        backgroundColor:
          direction === 1 ? theme.colors.primarySoft : theme.colors.surfaceAlt,
      }}
    >
      <Icon
        name={direction === 1 ? 'plus' : 'minus'}
        size={15}
        color={direction === 1 ? 'primary' : 'textMuted'}
        strokeWidth={2.4}
      />
    </PressableScale>
  );
}

/** One macro, with a bar showing its share of this food's own energy. */
function MacroLine({
  tone,
  label,
  grams,
  of,
}: {
  tone: ColorKey;
  label: string;
  grams: number;
  of: Nutrients;
}) {
  const theme = useTheme();

  // Against the largest of the macros present, so the four bars are
  // comparable with each other rather than each being its own scale.
  const largest = Math.max(of.proteinG, of.carbsG, of.fatG, of.fiberG ?? 0, 1);
  const ratio = Math.max(0, Math.min(1, grams / largest));

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
        <Text variant="metricS">{Math.round(grams * 10) / 10} g</Text>
      </View>
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.round(ratio * 100)}%`,
            height: '100%',
            borderRadius: 2,
            backgroundColor: theme.colors[tone],
          }}
        />
      </View>
    </View>
  );
}

function FactTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        gap: 4,
        padding: theme.spacing.md,
        borderRadius: theme.radius.media,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      {/*
        Never a zero for a missing figure. An unrecorded value printed as
        "0 g" is indistinguishable from a food that genuinely has none, and
        this screen is the one that feeds the journal.
      */}
      {value === null ? (
        <Text variant="footnote" color="textSubtle">
          not stated
        </Text>
      ) : (
        <Text variant="metricM" style={{ fontSize: 16 }}>
          {Math.round(value * 10) / 10} {unit}
        </Text>
      )}
    </View>
  );
}

function DailyValueRow({
  nutrientKey,
  label,
  nutrients,
  targets,
}: {
  nutrientKey: DailyValueKey;
  label: string;
  nutrients: Nutrients;
  targets: ReturnType<typeof usePreferencesStore.getState>['preferences']['dailyTargets'];
}) {
  const theme = useTheme();
  const { share, personal } = dailyValueFor(nutrientKey, nutrients, targets);

  const percent = share === null ? null : Math.round(share * 100);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <Text variant="callout" color="textMuted" style={{ width: 76 }}>
        {label}
      </Text>

      <View
        style={{
          flex: 1,
          height: 7,
          borderRadius: 4,
          backgroundColor: theme.colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        {percent === null ? null : (
          <View
            style={{
              width: `${Math.min(100, percent)}%`,
              height: '100%',
              borderRadius: 4,
              backgroundColor: theme.colors.primary,
            }}
          />
        )}
      </View>

      <Text
        variant="metricS"
        color={percent === null ? 'textSubtle' : 'text'}
        style={{ width: 54, textAlign: 'right' }}
        accessibilityLabel={
          percent === null
            ? `${label} not recorded`
            : `${label}, ${percent} percent of ${personal ? 'your goal' : 'a reference day'}`
        }
      >
        {percent === null ? 'n/a' : `${percent}%`}
      </Text>
    </View>
  );
}
