import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Badge,
  Disclosure,
  Row,
  Screen,
  Section,
  SegmentedControl,
  Surface,
  Text,
} from '@/components/ui';
import { useAuth } from '@/features/auth';
import { clearLocalJournal } from '@/features/journal';
import { deleteAllMealPhotos, deleteAllPhotos } from '@/features/photos';
import { clearLocalRecipes, toCuisineId } from '@/features/recipes';
import { cuisineLabel } from '@/features/recipes/options';
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

/**
 * Profile and settings.
 *
 * Built as native grouped lists, which is the pattern users already know for
 * settings and the reason this screen needs almost no explanatory text. Each
 * group has a heading; rows carry their own value on the right.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { preference, setPreference } = useThemeContext();
  const { status, user, signOut, deleteAccount } = useAuth();

  const preferences = usePreferencesStore((state) => state.preferences);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);
  const setMeasurementSystem = usePreferencesStore((state) => state.setMeasurementSystem);
  const resetPreferences = usePreferencesStore((state) => state.reset);

  const [clearing, setClearing] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);

  const confirmClearLocalData = () => {
    Alert.alert(
      'Delete everything on this device?',
      'Your saved meals, recipes, shopping lists and preferences will be removed from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setClearing(true);
              await clearLocalJournal();
              await clearLocalRecipes();
              deleteAllPhotos();
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

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'Your account and every meal, recipe and shopping list in it will be permanently removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setAccountBusy(true);
              const result = await deleteAccount();
              setAccountBusy(false);
              if (!result.ok) {
                // Say what happened rather than leaving them guessing
                // whether the account still exists.
                Alert.alert('Not deleted', result.error.message);
                return;
              }
              deleteAllPhotos();
              router.replace('/');
            })();
          },
        },
      ],
    );
  };

  /**
   * Turning photo keeping off clears the photos already kept.
   *
   * Otherwise the setting would only be a promise about future meals, while
   * the pictures the user is asking the app to stop keeping stay on disk.
   */
  const setRetainPhotos = (retainPhotos: boolean) => {
    setPreferences({ retainPhotos });
    if (!retainPhotos) deleteAllMealPhotos();
  };

  return (
    <Screen title="Profile" edges={{ top: true }}>
      {/* Account */}
      <Section title="Account" dense>
        <Surface variant="grouped">
          {status === 'signed_in' ? (
            <>
              <Row
                title={user?.email ?? 'Signed in'}
                subtitle="Your journal is backed up to your account"
                leading={<Icon name="profile" size={19} color="primary" />}
              />
              <Row
                title={accountBusy ? 'Signing out…' : 'Sign out'}
                divided
                onPress={() => {
                  void (async () => {
                    setAccountBusy(true);
                    await signOut();
                    setAccountBusy(false);
                  })();
                }}
              />
              <Row
                title="Delete my account"
                destructive
                divided
                onPress={confirmDeleteAccount}
              />
            </>
          ) : status === 'unavailable' ? (
            <Row
              title="No account in this build"
              subtitle="Meals are saved on this device only"
              leading={<Icon name="info" size={19} color="textMuted" />}
            />
          ) : (
            <>
              <Row
                title="Sign in"
                subtitle="Back up your journal and sync it across devices"
                leading={<Icon name="profile" size={19} color="primary" />}
                trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
                onPress={() => router.push('/(auth)/sign-in')}
              />
              <Row
                title="Create an account"
                divided
                trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
                onPress={() => router.push('/(auth)/sign-up')}
              />
            </>
          )}
        </Surface>

        {!env.isSupabaseConfigured ? (
          <Disclosure
            summary="Accounts are not configured in this build"
            detail={`Sign-in, cloud sync and photo analysis need a backend. Missing: ${describeMissingConfig().join(
              '; ',
            )}. Everything else works normally and your meals live on this device.`}
          />
        ) : null}
      </Section>

      {/* Insights */}
      <Section title="Insights" dense>
        <Surface variant="grouped">
          <Row
            title="Food patterns"
            subtitle="Counted from your saved meals, with the working shown"
            leading={<Icon name="insights" size={19} color="primary" />}
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/(tabs)/insights')}
          />
        </Surface>
      </Section>

      {/* Appearance and units: inline controls, no boxes. */}
      <Section title="Appearance" dense>
        <SegmentedControl
          options={THEME_OPTIONS}
          value={preference}
          onChange={(next: ThemePreference) => setPreference(next)}
          accessibilityLabel="Theme"
        />
      </Section>

      <Section title="Portion units" dense>
        <SegmentedControl
          options={UNIT_OPTIONS}
          value={preferences.measurementSystem}
          onChange={(next: MeasurementSystem) => setMeasurementSystem(next)}
          accessibilityLabel="Portion units"
        />
      </Section>

      {/* Food preferences */}
      <Section title="Food" dense>
        <Surface variant="grouped">
          <Row
            title="How I eat"
            subtitle={summarizePreferences(
              preferences.dietaryPatterns.length,
              preferences.favoriteCuisines.length,
            )}
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/(onboarding)/food')}
          />
          <Row
            title="Goal"
            subtitle={preferences.goal === 'none' ? 'None set' : formatGoal(preferences.goal)}
            divided
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/(onboarding)/goals')}
          />
          <Row
            title="Ingredients to avoid"
            subtitle={
              preferences.allergens.length === 0
                ? 'None saved'
                : preferences.allergens.join(', ')
            }
            divided
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/(onboarding)/food')}
          />
        </Surface>

        {preferences.allergens.length > 0 ? (
          <Disclosure
            summary="Avoiding an ingredient is not a safety check"
            detail="Filtering relies on recipe text and AI output, which can be wrong. Always read the real label before eating something you are allergic to."
            tone="caution"
          />
        ) : null}
      </Section>

      {/* Recipe defaults: Food Memory, inspectable. */}
      <Section title="Recipe defaults" dense>
        <Surface variant="grouped">
          <Row
            title="Servings"
            subtitle="Where the recipe creator starts"
            trailing={
              <Text variant="metricM" color="textMuted">
                {preferences.preferredServings}
              </Text>
            }
          />
          <Row
            title="Cuisine"
            subtitle="Remembered from the last recipe you created"
            divided
            trailing={
              <Text variant="footnote" color="textMuted">
                {cuisineLabel(toCuisineId(preferences.favoriteCuisineId)) ?? 'None'}
              </Text>
            }
          />
          <Row
            title="Forget these defaults"
            subtitle="Your recipes stay"
            divided
            onPress={() => setPreferences({ preferredServings: 4, favoriteCuisineId: null })}
          />
        </Surface>
      </Section>

      {/* Food Memory toggles */}
      <Section title="Food Memory" dense>
        <Surface variant="grouped">
          <ToggleRow
            title="Remember my meals"
            subtitle="Powers suggestions and weekly patterns"
            value={preferences.foodMemoryEnabled}
            onChange={(foodMemoryEnabled) => setPreferences({ foodMemoryEnabled })}
          />
          <ToggleRow
            title="Keep my meal photos"
            subtitle="Off by default. Turning this off also deletes photos already saved"
            value={preferences.retainPhotos}
            onChange={setRetainPhotos}
            divided
          />
        </Surface>
      </Section>

      {/* Data */}
      <Section title="Your data" dense>
        <Surface variant="grouped">
          <Row
            title={clearing ? 'Deleting…' : 'Delete everything on this device'}
            subtitle="Meals, recipes, lists and preferences. Cannot be undone."
            destructive
            leading={<Icon name="trash" size={19} color="danger" />}
            onPress={confirmClearLocalData}
          />
        </Surface>
      </Section>

      <View style={{ gap: theme.spacing.md, alignItems: 'center' }}>
        <Disclosure
          summary="FoodLens is not medical advice"
          detail="Nutrition figures are estimates, and photo analysis cannot see hidden oil, sugar or exact weights. Talk to a qualified professional about decisions regarding your health."
        />
        <Badge label="Version 0.1.0 · development" tone="neutral" />
      </View>
    </Screen>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  divided = false,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (next: boolean) => void;
  divided?: boolean;
}) {
  const theme = useTheme();

  return (
    <Row
      title={title}
      subtitle={subtitle}
      divided={divided}
      trailing={
        <Switch
          value={value}
          onValueChange={onChange}
          accessibilityLabel={title}
          trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceAlt }}
          thumbColor={theme.colors.surface}
        />
      }
    />
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
  return goal.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
}
