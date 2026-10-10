import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card, InfoNote, Text, TextField } from '@/components/ui';
import { GOAL_OPTIONS } from '@/features/onboarding/options';
import { StepLayout } from '@/features/onboarding/StepLayout';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import type { NutritionGoalKind } from '@/types/domain';
import { Pressable } from 'react-native';

/** Goals that make a calorie target meaningful enough to offer. */
const GOALS_WITH_TARGETS: readonly NutritionGoalKind[] = ['manage_weight', 'more_protein'];

interface TargetDraft {
  calories: string;
  protein: string;
}

export default function GoalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const preferences = usePreferencesStore((state) => state.preferences);
  const setGoal = usePreferencesStore((state) => state.setGoal);
  const setDailyTargets = usePreferencesStore((state) => state.setDailyTargets);

  const [goal, setGoalDraft] = useState<NutritionGoalKind>(preferences.goal);
  const [targets, setTargets] = useState<TargetDraft>({
    calories: preferences.dailyTargets.caloriesKcal?.toString() ?? '',
    protein: preferences.dailyTargets.proteinG?.toString() ?? '',
  });

  const showTargets = GOALS_WITH_TARGETS.includes(goal);

  const parsedCalories = parsePositiveInt(targets.calories);
  const parsedProtein = parsePositiveInt(targets.protein);

  const caloriesError =
    targets.calories.length > 0 && parsedCalories === null
      ? 'Enter a whole number of calories, or leave this empty.'
      : parsedCalories !== null && (parsedCalories < 800 || parsedCalories > 6000)
        ? 'Enter a value between 800 and 6000, or leave it empty.'
        : null;

  const proteinError =
    targets.protein.length > 0 && parsedProtein === null
      ? 'Enter a whole number of grams, or leave this empty.'
      : parsedProtein !== null && parsedProtein > 400
        ? 'Enter a value under 400 g, or leave it empty.'
        : null;

  const hasErrors = Boolean(caloriesError) || Boolean(proteinError);

  const save = () => {
    if (hasErrors) return;
    setGoal(goal);
    setDailyTargets({
      caloriesKcal: showTargets ? parsedCalories : null,
      proteinG: showTargets ? parsedProtein : null,
      // Carb and fat targets are a later feature; leaving them unset is honest.
      carbsG: null,
      fatG: null,
    });
    router.push('/(onboarding)/privacy');
  };

  return (
    <StepLayout
      step={3}
      totalSteps={4}
      title="What would you like out of this?"
      subtitle="Optional. It only changes what the app highlights."
      primaryLabel="Continue"
      onPrimary={save}
      primaryDisabled={hasErrors}
      skipLabel="Skip for now"
      onSkip={() => router.push('/(onboarding)/privacy')}
    >
      <View style={{ gap: theme.spacing.sm }}>
        {GOAL_OPTIONS.map((option) => {
          const selected = goal === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setGoalDraft(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
              accessibilityHint={option.description}
            >
              <Card
                variant={selected ? 'soft' : 'outlined'}
                style={{
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                  backgroundColor: selected
                    ? theme.colors.primarySoft
                    : theme.colors.surface,
                }}
              >
                <View style={{ gap: theme.spacing.xxs }}>
                  <Text
                    variant={selected ? 'headline' : 'body'}
                    color={selected ? 'primaryOnSoft' : 'text'}
                  >
                    {option.label}
                  </Text>
                  {option.description ? (
                    <Text variant="callout" color="textMuted">
                      {option.description}
                    </Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      {showTargets ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="label" color="textMuted">
            DAILY TARGETS (OPTIONAL)
          </Text>
          <TextField
            label="Calories"
            value={targets.calories}
            onChangeText={(calories) => setTargets((t) => ({ ...t, calories }))}
            keyboardType="number-pad"
            placeholder="e.g. 2100"
            error={caloriesError}
            help="Leave empty to track without a calorie target."
          />
          <TextField
            label="Protein (g)"
            value={targets.protein}
            onChangeText={(protein) => setTargets((t) => ({ ...t, protein }))}
            keyboardType="number-pad"
            placeholder="e.g. 120"
            error={proteinError}
          />
          <InfoNote
            title="We do not calculate targets for you"
            body="FoodLens does not estimate how much you should eat. Enter a number you have decided on yourself or with a professional. This app is not medical advice."
            tone="warning"
          />
        </View>
      ) : null}
    </StepLayout>
  );
}

/** Parses a whole positive number, or null when the text is not one. */
function parsePositiveInt(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number.parseInt(trimmed, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}
