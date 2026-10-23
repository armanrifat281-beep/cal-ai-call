import { useMemo } from 'react';
import { View } from 'react-native';

import {
  Disclosure,
  Metric,
  NumberField,
  PressableScale,
  SegmentedControl,
  Surface,
  Text,
} from '@/components/ui';
import { useTheme } from '@/theme';
import type {
  ActivityLevel,
  BiologicalSex,
  BodyBasics,
  NutritionGoalKind,
} from '@/types/domain';

import { ACTIVITY_LABELS, suggestDailyTargets } from './targets';

/**
 * The four questions a calorie target needs, and the target itself.
 *
 * Used by onboarding and by Profile, which is the point of it being a
 * component: the screen where you first set a target and the screen where
 * you change it later must agree, and two copies of a form never do.
 *
 * The app used to ask people to type a calorie number straight in. Almost
 * nobody knows theirs, so it stayed empty, and Home showed calories eaten
 * with nothing to measure them against - a dial pointing at nothing.
 */

const SEX_OPTIONS: readonly { value: BiologicalSex; label: string }[] = [
  { value: 'female', label: 'Woman' },
  { value: 'male', label: 'Man' },
  { value: 'unspecified', label: 'Rather not' },
];

const ACTIVITY_ORDER: readonly ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'very',
];

export interface TargetSetupProps {
  basics: BodyBasics;
  onChange: (next: BodyBasics) => void;
  /** The goal decides whether 500 kcal comes off the figure. */
  goal: NutritionGoalKind;
}

export function TargetSetup({ basics, onChange, goal }: TargetSetupProps) {
  const theme = useTheme();
  const suggested = useMemo(
    () => suggestDailyTargets(basics, goal),
    [basics, goal],
  );

  const set = (patch: Partial<BodyBasics>) => onChange({ ...basics, ...patch });

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textMuted">
          You
        </Text>
        <SegmentedControl
          options={SEX_OPTIONS}
          value={basics.sex}
          onChange={(sex) => set({ sex })}
          accessibilityLabel="Sex, used only for the calorie equation"
        />
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Age"
            value={basics.ageYears}
            onChangeValue={(ageYears) => set({ ageYears })}
            allowDecimal={false}
            min={13}
            max={100}
            placeholder="30"
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Height (cm)"
            value={basics.heightCm}
            onChangeValue={(heightCm) => set({ heightCm })}
            allowDecimal={false}
            min={120}
            max={230}
            placeholder="165"
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Weight (kg)"
            value={basics.weightKg}
            onChangeValue={(weightKg) => set({ weightKg })}
            min={30}
            max={300}
            placeholder="62"
          />
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textMuted">
          How your days go
        </Text>
        {ACTIVITY_ORDER.map((level) => {
          const selected = basics.activity === level;
          return (
            <PressableScale
              key={level}
              onPress={() => set({ activity: level })}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={ACTIVITY_LABELS[level]}
              scaleTo={0.99}
            >
              <View
                style={{
                  padding: theme.spacing.base,
                  borderRadius: theme.radius.control,
                  backgroundColor: selected
                    ? theme.colors.primarySoft
                    : theme.colors.surfaceAlt,
                }}
              >
                <Text variant="body" color={selected ? 'primaryOnSoft' : 'text'}>
                  {ACTIVITY_LABELS[level]}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>

      {/*
        The payoff, as soon as the four answers allow it. Nothing is shown
        before that: a figure that moves as you type reads as a guess.
      */}
      {suggested ? (
        <Surface
          variant="raised"
          padding="lg"
          style={{ alignItems: 'center', gap: theme.spacing.sm }}
        >
          <Metric
            value={String(suggested.caloriesKcal)}
            label="kcal a day"
            size="xl"
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
            <Metric value={`${suggested.proteinG} g`} label="Protein" />
            <Metric value={`${suggested.carbsG} g`} label="Carbs" />
            <Metric value={`${suggested.fatG} g`} label="Fat" />
          </View>
          <Text variant="footnote" color="textMuted">
            {suggested.caloriesKcal === suggested.maintenanceKcal
              ? 'About what a day costs you.'
              : `${suggested.maintenanceKcal} is roughly what a day costs you; this is 500 under it.`}
          </Text>
        </Surface>
      ) : (
        <Surface variant="grouped" padding="lg">
          <Text variant="footnote" color="textMuted">
            Fill in age, height and weight and your target appears here. You can
            skip this - the app works without a target, it just has nothing to
            measure your day against.
          </Text>
        </Surface>
      )}

      <Disclosure
        summary="Where this number comes from"
        detail="The Mifflin-St Jeor equation, the standard arithmetic on height, weight, age and sex, multiplied by how active you say you are. It is a starting point, not a measurement: it is around 10 percent out for most people and further out if you are pregnant, very muscular, or managing a condition that changes how much energy you use. You can change the figure any time, and FoodLens is not a medical device and gives no medical or dietary advice."
      />
    </View>
  );
}
