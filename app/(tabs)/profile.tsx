import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Badge,
  BrandGradient,
  Disclosure,
  PressableScale,
  Row,
  Screen,
  Section,
  SegmentedControl,
  Surface,
  Text,
} from '@/components/ui';
import { useAuth } from '@/features/auth';
import { clearLocalJournal, useWeekStripDays } from '@/features/journal';
import { hasEnoughForInsights } from '@/features/memory/insights';
import { forgetAvatarLocally } from '@/features/profile';
import {
  deleteAllMealPhotos,
  deleteAllPhotos,
  forgetStoredMealPhotos,
} from '@/features/photos';
import { clearLocalRecipes, toCuisineId } from '@/features/recipes';
import { clearLocalWater } from '@/features/water';
import { clearLocalWeight } from '@/features/weight';
import { cuisineLabel } from '@/features/recipes/options';
import { describeMissingConfig, env } from '@/lib/env';
import { usePreferencesStore } from '@/store/preferencesStore';
import { ramps, useTheme, useThemeContext, type ThemePreference } from '@/theme';
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

  /*
    Profile reads no journal of its own, so this is one range read for the
    seven days Insights defaults to - the same window, so the row and the
    screen cannot disagree about whether there is anything to show.
  */
  const { days: week } = useWeekStripDays();
  const insightsReady = useMemo(
    () =>
      hasEnoughForInsights(
        week.reduce((sum, day) => sum + day.entryCount, 0),
        week.filter((day) => day.entryCount > 0).length,
      ),
    [week],
  );

  const preferences = usePreferencesStore((state) => state.preferences);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);
  const setMeasurementSystem = usePreferencesStore((state) => state.setMeasurementSystem);
  const resetPreferences = usePreferencesStore((state) => state.reset);

  const [clearing, setClearing] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

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
              await clearLocalWater();
              await clearLocalWeight();
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
              forgetAvatarLocally();
              /*
                Not `/`: that path matches both `app/index.tsx` and
                `app/(tabs)/index.tsx`, and resolving to the second one would
                land a deleted account back on Home. Name the destination.
              */
              router.replace('/(auth)/welcome');
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
   * the pictures the user is asking the app to stop keeping stay behind.
   *
   * There are two places they are kept: this device, and - when the setting
   * was on - the `meal-photos` bucket, with the path recorded on the entry.
   * Only the device half used to be cleared.
   *
   * The stored half goes first, because it is the half that can fail. If it
   * does, nothing is deleted, the switch stays on, and the user is told -
   * rather than being shown an off switch over photos that are still there.
   */
  const setRetainPhotos = (retainPhotos: boolean) => {
    if (retainPhotos) {
      setPreferences({ retainPhotos: true });
      return;
    }

    void (async () => {
      setPhotoBusy(true);
      const forgotten = await forgetStoredMealPhotos();
      setPhotoBusy(false);

      if (!forgotten.ok) {
        Alert.alert('Photos not deleted', forgotten.error.message);
        return;
      }

      deleteAllMealPhotos();
      setPreferences({ retainPhotos: false });
    })();
  };

  return (
    <Screen title="Profile" edges={{ top: true }}>
      {/*
        Who you are, before the settings list.

        The screen opened straight onto "You > Add your name", which is a
        settings row where a person expects to see themselves. An initial and
        a name is not decoration: it is the one place in the app that
        confirms whose data this is, which matters most on the screen that
        also holds sign-out and delete-account.
      */}
      <PressableScale
        onPress={() => router.push('/settings/profile')}
        accessibilityRole="button"
        accessibilityLabel={
          preferences.displayName ?? 'Add your name'
        }
        scaleTo={0.99}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surfaceAlt,
          }}
        >
          <BrandGradient
            extent="band"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <Text variant="title2" color={ramps.neutral[25]}>
            {initialFor(preferences.displayName)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title2">
            {preferences.displayName ?? 'Add your name'}
          </Text>
          <Text variant="footnote" color="textMuted">
            {/* With no name the line has to say why one is worth adding;
                once there is one, whose account this is matters more. */}
            {preferences.displayName === null
              ? 'So Home can greet you by name'
              : (user?.email ?? 'Saved on this device')}
          </Text>
        </View>
        <Icon name="chevronRight" size={16} color="textSubtle" />
      </PressableScale>

      {/* Appearance, in the open rather than three screens down: it is the
          setting people reach for first and change most. */}
      <Section title="Appearance" dense>
        <SegmentedControl
          options={THEME_OPTIONS}
          value={preference}
          onChange={(next: ThemePreference) => setPreference(next)}
          accessibilityLabel="Theme"
        />
      </Section>

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
                title="Change password"
                divided
                trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
                onPress={() => router.push('/settings/change-password')}
              />
              <Row
                title={accountBusy ? 'Signing out…' : 'Sign out'}
                divided
                onPress={() => {
                  void (async () => {
                    setAccountBusy(true);
                    const result = await signOut();
                    setAccountBusy(false);

                    /*
                      Leaving is driven by the action, not by a guard watching
                      the session from the tab layout. That guard fired on
                      every render, so a momentary gap in the session threw
                      people out of whatever they were doing - and only a
                      deliberate sign-out should take anyone anywhere.

                      Leave whether or not the server agreed. `signOut` drops
                      the local session either way, on the grounds that
                      someone who asked to be signed out should not still look
                      signed in - so staying here left them inside the app
                      with no session, which is the one outcome nobody asked
                      for. The message explains the half that failed.
                    */
                    forgetAvatarLocally();
                    router.replace('/(auth)/welcome');
                    if (!result.ok) {
                      Alert.alert('Signed out on this phone', result.error.message);
                    }
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
                subtitle="Back up your meals and recipes, and sync them across devices"
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

      {/* Insights, once there is enough logged for it to say anything. */}
      {insightsReady ? (
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
      ) : null}

      {/* Units: an inline control, no box. */}
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
            title="My kitchen"
            subtitle={
              preferences.pantryItems.length === 0
                ? 'Say what you have, and recipes will show what you need'
                : `${preferences.pantryItems.length} ingredient${preferences.pantryItems.length === 1 ? '' : 's'} at home`
            }
            divided
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/settings/kitchen')}
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
            subtitle={
              photoBusy
                ? 'Deleting the photos already saved…'
                : 'Off by default. Turning this off also deletes photos already saved'
            }
            value={preferences.retainPhotos}
            onChange={setRetainPhotos}
            disabled={photoBusy}
            divided
          />
        </Surface>
      </Section>

      <Section title="About" dense>
        <Surface variant="grouped">
          <Row
            title="Help"
            subtitle="How the estimates work, and how to get better ones"
            leading={<Icon name="info" size={19} color="textMuted" />}
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/settings/help')}
          />
          <Row
            title="What FoodLens does with your data"
            divided
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/settings/privacy')}
          />
          <Row
            title="Terms of use"
            divided
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/settings/terms')}
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
  disabled = false,
  divided = false,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (next: boolean) => void;
  /** Held while a change is being carried out, so it cannot be flipped twice. */
  disabled?: boolean;
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
          disabled={disabled}
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

/**
 * One letter for the avatar.
 *
 * A dot rather than a letter when there is no name: an initial invented from
 * an email address would show a character the user never typed.
 */
function initialFor(displayName: string | null): string {
  const first = displayName?.trim().charAt(0);
  return first === undefined || first === '' ? '·' : first.toUpperCase();
}
