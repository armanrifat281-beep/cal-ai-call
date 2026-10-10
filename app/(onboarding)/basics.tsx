import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Chip, InfoNote, SegmentedControl, Text } from '@/components/ui';
import { LANGUAGE_OPTIONS, REGION_OPTIONS } from '@/features/onboarding/options';
import { StepLayout } from '@/features/onboarding/StepLayout';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import type { MeasurementSystem } from '@/types/domain';

const UNIT_OPTIONS = [
  { value: 'metric' as const, label: 'Grams, ml' },
  { value: 'imperial' as const, label: 'Ounces, cups' },
];

export default function BasicsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const preferences = usePreferencesStore((state) => state.preferences);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);

  const [language, setLanguage] = useState(preferences.language);
  const [countryCode, setCountryCode] = useState(preferences.countryCode);
  const [units, setUnits] = useState<MeasurementSystem>(preferences.measurementSystem);

  const save = () => {
    setPreferences({ language, countryCode, measurementSystem: units });
    router.push('/(onboarding)/food');
  };

  return (
    <StepLayout
      step={1}
      totalSteps={4}
      title="Where do you eat?"
      subtitle="This helps FoodLens match the dishes and names you actually use."
      primaryLabel="Continue"
      onPrimary={save}
      skipLabel="Skip for now"
      onSkip={() => router.push('/(onboarding)/food')}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="bodySmStrong" color="textMuted">
          LANGUAGE
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {LANGUAGE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={language === option.value}
              onPress={() => setLanguage(option.value)}
            />
          ))}
        </View>
        <Text variant="caption" color="textMuted">
          The app interface is in English today. Your choice is stored and used to
          prefer local food names when matching.
        </Text>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="bodySmStrong" color="textMuted">
          FOOD REGION
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {REGION_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={countryCode === option.value}
              onPress={() =>
                setCountryCode(countryCode === option.value ? null : option.value)
              }
            />
          ))}
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="bodySmStrong" color="textMuted">
          PORTION UNITS
        </Text>
        <SegmentedControl
          options={UNIT_OPTIONS}
          value={units}
          onChange={setUnits}
          accessibilityLabel="Portion units"
        />
      </View>

      <InfoNote
        body="None of this is required. You can change all of it later in Profile."
        tone="neutral"
      />
    </StepLayout>
  );
}
