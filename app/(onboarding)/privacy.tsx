import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { Button, Disclosure, Divider, Surface, Text } from '@/components/ui';
import { StepLayout } from '@/features/onboarding/StepLayout';
import { env } from '@/lib/env';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

/** Plain statements about what the app does with data. No legal boilerplate. */
const FACTS = [
  {
    title: 'Your meals stay yours',
    body: env.isSupabaseConfigured
      ? 'Meals are stored in your own account and protected by database rules so no other user can read them.'
      : 'This build has no backend configured yet, so meals are stored only on this device and never leave it.',
  },
  {
    title: 'Photos are analysed, not collected',
    body: 'A photo is sent to the analysis service to be read, and is not kept afterwards unless you turn on the setting below.',
  },
  {
    title: 'We send as little as possible',
    body: 'The analysis request contains the photo and nothing about who you are. Your name, email and allergy list are never sent to the AI provider.',
  },
];

export default function PrivacyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const preferences = usePreferencesStore((state) => state.preferences);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);
  const completeOnboarding = usePreferencesStore((state) => state.completeOnboarding);

  const [foodMemory, setFoodMemory] = useState(preferences.foodMemoryEnabled);
  const [retainPhotos, setRetainPhotos] = useState(preferences.retainPhotos);

  const finish = () => {
    setPreferences({ foodMemoryEnabled: foodMemory, retainPhotos });
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <StepLayout
      step={4}
      totalSteps={4}
      title="Before you start"
      subtitle="What FoodLens does with your data, and the two choices that are yours."
      primaryLabel="Start using FoodLens"
      onPrimary={finish}
    >
      <View style={{ gap: theme.spacing.md }}>
        {FACTS.map((fact) => (
          <View key={fact.title} style={{ gap: theme.spacing.xxs }}>
            <Text variant="headline">{fact.title}</Text>
            <Text variant="callout" color="textMuted">
              {fact.body}
            </Text>
          </View>
        ))}
      </View>

      <Surface variant="grouped">
        <SettingToggle
          title="Remember my meals"
          body="Lets FoodLens suggest meals you have logged before and show weekly patterns. Turning this off means no history is used for suggestions."
          value={foodMemory}
          onChange={setFoodMemory}
        />
        <Divider />
        <SettingToggle
          title="Keep my meal photos"
          body="Off by default. When off, a photo is deleted right after it is analysed and your journal keeps only the food names and numbers."
          value={retainPhotos}
          onChange={setRetainPhotos}
        />
      </Surface>

      <Disclosure summary="What FoodLens is not" detail="It does not diagnose, treat or give medical or dietary advice, and its numbers are estimates. Talk to a qualified professional about decisions regarding your health." tone="caution" />

      <Text variant="caption" color="textMuted">
        You can change every one of these later in Settings, and delete your
        data at any time.
      </Text>

      {/*
        The last moment before the app opens, and the second place a
        returning user might look for their account. Offered, never
        required: everything works without one.
      */}
      <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
        <Text variant="footnote" color="textMuted">
          Already have a FoodLens account?
        </Text>
        <Button
          label="Sign in"
          variant="ghost"
          size="sm"
          onPress={() => router.push('/(auth)/sign-in')}
        />
      </View>
    </StepLayout>
  );
}

function SettingToggle({
  title,
  body,
  value,
  onChange,
}: {
  title: string;
  body: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
        padding: theme.spacing.base,
      }}
    >
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="headline">{title}</Text>
        <Text variant="caption" color="textMuted" style={{ lineHeight: 18 }}>
          {body}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={title}
        trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceAlt }}
        thumbColor={theme.colors.surface}
      />
    </View>
  );
}
