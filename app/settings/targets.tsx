import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, NumberField, Screen, Text } from '@/components/ui';
import { suggestDailyTargets, TargetSetup } from '@/features/nutrition';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import type { BodyBasics } from '@/types/domain';

/**
 * Changing the daily target after onboarding.
 *
 * The same form as the onboarding step, deliberately: the screen where a
 * target is first set and the screen where it is changed have to agree, and
 * two copies of a form never do for long.
 *
 * The one thing this adds is the override. Someone who has been given a
 * figure by a dietitian should not have to make the equation produce it by
 * fiddling with their stated activity level.
 */
export default function TargetsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const preferences = usePreferencesStore((state) => state.preferences);
  const setBodyBasics = usePreferencesStore((state) => state.setBodyBasics);
  const setDailyTargets = usePreferencesStore((state) => state.setDailyTargets);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);

  const [basics, setBasics] = useState<BodyBasics>(preferences.bodyBasics);
  const suggested = suggestDailyTargets(basics, preferences.goal);

  // Pre-filled only when the stored target is not the one the equation gives,
  // so an untouched target does not look like a manual choice.
  const [ownCalories, setOwnCalories] = useState<number | null>(
    preferences.dailyTargets.caloriesKcal !== null &&
      preferences.dailyTargets.caloriesKcal !== suggested?.caloriesKcal
      ? preferences.dailyTargets.caloriesKcal
      : null,
  );

  const [waterLitres, setWaterLitres] = useState<number | null>(
    preferences.waterTargetMl === null ? null : preferences.waterTargetMl / 1000,
  );

  const save = () => {
    setBodyBasics(basics);
    // Millilitres on the inside, litres on the screen: nobody thinks in
    // millilitres about a day's water.
    setPreferences({
      waterTargetMl: waterLitres === null ? null : Math.round(waterLitres * 1000),
    });

    if (ownCalories !== null) {
      // Their number, and the macros scaled to it so the three still add up
      // to the calories shown on Home.
      const ratio = suggested ? ownCalories / suggested.caloriesKcal : null;
      setDailyTargets({
        caloriesKcal: ownCalories,
        proteinG: suggested && ratio ? Math.round(suggested.proteinG * ratio) : null,
        carbsG: suggested && ratio ? Math.round(suggested.carbsG * ratio) : null,
        fatG: suggested && ratio ? Math.round(suggested.fatG * ratio) : null,
      });
    } else {
      setDailyTargets({
        caloriesKcal: suggested?.caloriesKcal ?? null,
        proteinG: suggested?.proteinG ?? null,
        carbsG: suggested?.carbsG ?? null,
        fatG: suggested?.fatG ?? null,
      });
    }

    router.back();
  };

  return (
    <Screen
      edges={{ bottom: true }}
      footer={<Button label="Save target" onPress={save} size="lg" fullWidth haptic />}
    >
      <TargetSetup basics={basics} onChange={setBasics} goal={preferences.goal} />

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textMuted">
          Water
        </Text>
        <NumberField
          label="Water a day (litres)"
          value={waterLitres}
          onChangeValue={setWaterLitres}
          min={0.5}
          max={6}
          placeholder="2"
          help="Leave empty for no target. The glasses on Home then just count what you drank."
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textMuted">
          Or use your own number
        </Text>
        <NumberField
          label="Calories a day"
          value={ownCalories}
          onChangeValue={setOwnCalories}
          allowDecimal={false}
          min={800}
          max={6000}
          placeholder={suggested ? String(suggested.caloriesKcal) : 'e.g. 2100'}
          help="Leave empty to use the figure above. A number here replaces it, and the macros are scaled to match."
        />
      </View>
    </Screen>
  );
}
