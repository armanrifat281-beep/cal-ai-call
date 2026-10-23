import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { suggestDailyTargets, TargetSetup } from '@/features/nutrition';
import { GOAL_OPTIONS } from '@/features/onboarding/options';
import { StepLayout } from '@/features/onboarding/StepLayout';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import type { BodyBasics, NutritionGoalKind } from '@/types/domain';

/**
 * The goal, and the number the whole app measures against.
 *
 * This step used to ask people to type a calorie target in themselves, on
 * the principle that working one out would be personalised health advice.
 * The principle was defensible and the result was not: almost nobody knows
 * their number, so the field stayed empty, and Home opened on calories eaten
 * with nothing to compare them to - which read as an app that did not work.
 *
 * It now does the same arithmetic every calorie app does, shows its working,
 * says plainly how rough it is, and lets the figure be changed at any time
 * from Profile. Skipping is still one tap, and skipping still leaves a
 * perfectly usable app.
 */
export default function GoalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const preferences = usePreferencesStore((state) => state.preferences);
  const setGoal = usePreferencesStore((state) => state.setGoal);
  const setBodyBasics = usePreferencesStore((state) => state.setBodyBasics);
  const setDailyTargets = usePreferencesStore((state) => state.setDailyTargets);

  const [goal, setGoalDraft] = useState<NutritionGoalKind>(preferences.goal);
  const [basics, setBasics] = useState<BodyBasics>(preferences.bodyBasics);

  const save = () => {
    setGoal(goal);
    setBodyBasics(basics);

    const suggested = suggestDailyTargets(basics, goal);
    // Null when the measurements are incomplete, which is a real answer:
    // the app then tracks without a target rather than inventing one.
    setDailyTargets({
      caloriesKcal: suggested?.caloriesKcal ?? null,
      proteinG: suggested?.proteinG ?? null,
      carbsG: suggested?.carbsG ?? null,
      fatG: suggested?.fatG ?? null,
    });
    router.push('/(onboarding)/privacy');
  };

  return (
    <StepLayout
      step={3}
      totalSteps={4}
      title="What would you like out of this?"
      subtitle="Your answers set the daily target the rest of the app measures against."
      primaryLabel="Continue"
      onPrimary={save}
      skipLabel="Skip for now"
      onSkip={() => router.push('/(onboarding)/privacy')}
    >
      <View style={{ gap: theme.spacing.sm }}>
        {GOAL_OPTIONS.map((option) => {
          const selected = goal === option.value;
          return (
            <PressableScale
              key={option.value}
              onPress={() => setGoalDraft(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
              accessibilityHint={option.description}
              scaleTo={0.99}
            >
              {/*
                Selection is a tonal fill, not a border swap. Toggling a
                1px outline to 2px is a weak signal, and it shifts the layout
                by a pixel as the options change.
              */}
              <View
                style={{
                  gap: 3,
                  padding: theme.spacing.base,
                  borderRadius: theme.radius.control,
                  backgroundColor: selected
                    ? theme.colors.primarySoft
                    : theme.colors.surfaceAlt,
                }}
              >
                <Text variant="headline" color={selected ? 'primaryOnSoft' : 'text'}>
                  {option.label}
                </Text>
                {option.description ? (
                  <Text
                    variant="footnote"
                    color={selected ? 'primaryOnSoft' : 'textMuted'}
                  >
                    {option.description}
                  </Text>
                ) : null}
              </View>
            </PressableScale>
          );
        })}
      </View>

      <TargetSetup basics={basics} onChange={setBasics} goal={goal} />
    </StepLayout>
  );
}
