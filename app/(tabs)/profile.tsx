import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Badge,
  Card,
  Divider,
  InfoNote,
  ListRow,
  Screen,
  SegmentedControl,
  Text,
} from '@/components/ui';
import { clearLocalJournal } from '@/features/journal';
import { describeMissingConfig, env } from '@/lib/env';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme, useThemeContext, type ThemePreference } from '@/theme';
import type { MeasurementSystem } from '@/types/domain';

const THEME_OPTIONS = [
  { value: 'system' as const, label: 'System' },
  { value: 'light' as const, label: 'Light' },
  { value: 'dark' as const, label: 'Dark' },
];

const UNIT_OPTIONS = [
  { value: 'metric' as const, label: 'Grams, ml' },
  { value: 'imperial' as const, label: 'Ounces, cups' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { preference, setPreference } = useThemeContext();

  const preferences = usePreferencesStore((state) => state.preferences);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);
  const setMeasurementSystem = usePreferencesStore((state) => state.setMeasurementSystem);
  const resetPreferences = usePreferencesStore((state) => state.reset);

  const [clearing, setClearing] = useState(false);

  const missingConfig = describeMissingConfig();

  const confirmClearLocalData = () => {
    Alert.alert(
      'Delete everything on this device?',
      'Your saved meals, saved quick meals and preferences will be removed from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setClearing(true);
              await clearLocalJournal();
              resetPreferences();
              setClearing(false);
              // Preferences are gone, so the boot gate sends them to onboarding.
              router.replace('/');
            })();
          },
        },
      ],
    );
  };

  return (
    <Screen edges={{ top: true }} contentStyle={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title">Profile</Text>
        <View style={{ flexDirection: 'row' }}>
          <Badge
            label={env.isSupabaseConfigured ? 'Account backend configured' : 'Local only - no account'}
            tone={env.isSupabaseConfigured ? 'success' : 'neutral'}
          />
        </View>
      </View>

      {!env.isSupabaseConfigured ? (
        <InfoNote
          title="Accounts are not set up in this build"
          body={`Sign-in, cloud sync and photo analysis need a backend. Missing configuration: ${missingConfig.join(
            ', ',
          )}. Until then your meals live on this device and everything else works normally.`}
          tone="neutral"
        />
      ) : null}

      <Section title="Appearance">
        <View style={{ padding: theme.spacing.base, gap: theme.spacing.sm }}>
          <Text variant="bodySmStrong" color="textMuted">
            THEME
          </Text>
          <SegmentedControl
            options={THEME_OPTIONS}
            value={preference}
            onChange={(next: ThemePreference) => setPreference(next)}
            accessibilityLabel="Theme"
          />
        </View>
      </Section>

      <Section title="Units and region">
        <View style={{ padding: theme.spacing.base, gap: theme.spacing.sm }}>
          <Text variant="bodySmStrong" color="textMuted">
            PORTION UNITS
          </Text>
          <SegmentedControl
            options={UNIT_OPTIONS}
            value={preferences.measurementSystem}
            onChange={(next: MeasurementSystem) => setMeasurementSystem(next)}
            accessibilityLabel="Portion units"
          />
        </View>
        <Divider />
        <ListRow
          title="Food preferences"
          subtitle={summarizePreferences(preferences.dietaryPatterns.length, preferences.favoriteCuisines.length)}
          trailing={<Icon name="chevronRight" size={18} color="textMuted" />}
          onPress={() => router.push('/(onboarding)/food')}
          accessibilityHint="Opens the eating pattern and cuisine options"
        />
        <Divider />
        <ListRow
          title="Goal"
          subtitle={preferences.goal === 'none' ? 'No goal set' : formatGoal(preferences.goal)}
          trailing={<Icon name="chevronRight" size={18} color="textMuted" />}
          onPress={() => router.push('/(onboarding)/goals')}
        />
      </Section>

      <Section title="Food Memory">
        <ToggleRow
          title="Remember my meals"
          body="Lets FoodLens suggest meals you logged before and show weekly patterns, all computed from your saved entries."
          value={preferences.foodMemoryEnabled}
          onChange={(foodMemoryEnabled) => setPreferences({ foodMemoryEnabled })}
        />
        <Divider />
        <ToggleRow
          title="Keep my meal photos"
          body="When off, a photo is deleted right after analysis and only the food names and numbers are kept."
          value={preferences.retainPhotos}
          onChange={(retainPhotos) => setPreferences({ retainPhotos })}
        />
      </Section>

      <Section title="Ingredients to avoid">
        {preferences.allergens.length === 0 ? (
          <ListRow
            title="None saved"
            subtitle="Add ingredients and meal suggestions containing them will be filtered out."
            trailing={<Icon name="chevronRight" size={18} color="textMuted" />}
            onPress={() => router.push('/(onboarding)/food')}
          />
        ) : (
          <>
            <View style={{ padding: theme.spacing.base, gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {preferences.allergens.map((allergen) => (
                  <Badge key={allergen} label={allergen} tone="warning" />
                ))}
              </View>
              <InfoNote
                title="Not a safety check"
                body="Filtering relies on recipe text and AI output, which can be wrong. Always read the real label before eating something you are allergic to."
                tone="warning"
              />
            </View>
            <Divider />
            <ListRow
              title="Edit ingredients to avoid"
              trailing={<Icon name="chevronRight" size={18} color="textMuted" />}
              onPress={() => router.push('/(onboarding)/food')}
            />
          </>
        )}
      </Section>

      <Section title="Your data">
        <ListRow
          title="Delete everything on this device"
          subtitle={
            clearing
              ? 'Deleting...'
              : 'Removes saved meals and preferences stored locally. Cannot be undone.'
          }
          destructive
          leading={<Icon name="trash" size={20} color="danger" />}
          onPress={confirmClearLocalData}
        />
      </Section>

      <InfoNote
        title="FoodLens is not medical advice"
        body="Nutrition figures are estimates, and photo analysis cannot see hidden oil, sugar or exact weights. Talk to a qualified professional about decisions regarding your health."
        tone="warning"
      />

      <Text variant="caption" color="textMuted" align="center">
        FoodLens AI - version 0.1.0 (development)
      </Text>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="bodySmStrong" color="textMuted">
        {title.toUpperCase()}
      </Text>
      <Card padding="none">{children}</Card>
    </View>
  );
}

function ToggleRow({
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
        <Text variant="bodyStrong">{title}</Text>
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

function summarizePreferences(patterns: number, cuisines: number): string {
  if (patterns === 0 && cuisines === 0) return 'Nothing set';
  const parts: string[] = [];
  if (patterns > 0) parts.push(`${patterns} eating pattern${patterns === 1 ? '' : 's'}`);
  if (cuisines > 0) parts.push(`${cuisines} cuisine${cuisines === 1 ? '' : 's'}`);
  return parts.join(', ');
}

function formatGoal(goal: string): string {
  return goal.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
