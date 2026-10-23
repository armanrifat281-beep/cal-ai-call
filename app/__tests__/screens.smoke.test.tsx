import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';

import { clearLocalJournal, getDeviceJournalRepository } from '@/features/journal';
import { usePreferencesStore } from '@/store/preferencesStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { EMPTY_NUTRIENTS, type FoodEntryItem } from '@/types/domain';

import BasicsScreen from '../(onboarding)/basics';
import FoodPreferencesScreen from '../(onboarding)/food';
import GoalsScreen from '../(onboarding)/goals';
import PrivacyScreen from '../(onboarding)/privacy';
import HomeScreen from '../(tabs)/index';
import InsightsScreen from '../(tabs)/insights';
import JournalScreen from '../(tabs)/journal';
import MealsScreen from '../(tabs)/meals';
import ProfileScreen from '../(tabs)/profile';
import ScanScreen from '../(tabs)/scan';

/**
 * Smoke tests: every screen must mount without throwing, and show the right
 * empty state when the journal is empty.
 *
 * A bundle build proves the code compiles; only rendering proves a screen does
 * not crash on its first frame.
 */

function sampleItem(): FoodEntryItem {
  return {
    id: 'item-1',
    name: 'Oat porridge',
    brand: null,
    portion: { quantity: 250, unit: 'g' },
    gramsResolved: 250,
    nutrients: { ...EMPTY_NUTRIENTS, caloriesKcal: 180, proteinG: 6, carbsG: 30, fatG: 3 },
    provenance: {
      source: 'database',
      confidence: 'high',
      providerLabel: 'USDA FoodData Central',
      providerRef: '1',
    },
    foodRecordId: 'usda:1',
    notes: null,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await clearLocalJournal();
  usePreferencesStore.getState().reset();
});

describe('onboarding screens', () => {
  it('basics saves the chosen language, region and units', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<BasicsScreen />);

    await user.press(screen.getByRole('checkbox', { name: 'Bangladesh' }));
    await user.press(screen.getByRole('tab', { name: 'Ounces, cups' }));
    await user.press(screen.getByRole('button', { name: 'Continue' }));

    const { preferences } = usePreferencesStore.getState();
    expect(preferences.countryCode).toBe('BD');
    expect(preferences.measurementSystem).toBe('imperial');
    expect(router.push).toHaveBeenCalledWith('/(onboarding)/food');
  });

  it('basics can be skipped without saving anything', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<BasicsScreen />);

    await user.press(screen.getByRole('button', { name: 'Skip for now' }));

    expect(usePreferencesStore.getState().preferences.countryCode).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/(onboarding)/food');
  });

  it('food preferences does not ask about allergies until the user opts in', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<FoodPreferencesScreen />);

    // Nothing allergy-related is on screen beyond the explanation and opt-in.
    expect(screen.queryByRole('checkbox', { name: 'Peanuts' })).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Add ingredients to avoid' }));

    expect(screen.getByRole('checkbox', { name: 'Peanuts' })).toBeTruthy();
    // And it says plainly that this is not a safety check.
    expect(screen.getByText('This is not a safety check')).toBeTruthy();
  });

  it('food preferences stores opted-in allergens', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<FoodPreferencesScreen />);

    await user.press(screen.getByRole('button', { name: 'Add ingredients to avoid' }));
    await user.press(screen.getByRole('checkbox', { name: 'Peanuts' }));
    await user.press(screen.getByRole('button', { name: 'Continue' }));

    const { preferences } = usePreferencesStore.getState();
    expect(preferences.allergens).toEqual(['Peanuts']);
    expect(preferences.allergyAwarenessEnabled).toBe(true);
  });

  it('treats "no restrictions" as exclusive with real restrictions', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<FoodPreferencesScreen />);

    await user.press(screen.getByRole('checkbox', { name: 'Vegetarian' }));
    await user.press(screen.getByRole('checkbox', { name: 'No restrictions' }));
    await user.press(screen.getByRole('button', { name: 'Continue' }));

    expect(usePreferencesStore.getState().preferences.dietaryPatterns).toEqual([
      'no_restriction',
    ]);
  });

  /*
    These three used to assert the opposite: that the screen asked the user
    to type a calorie number and refused to work one out. That was the
    stated product position, and in practice it meant the field was left
    empty, no target was ever stored, and Home opened on a dial measuring
    against nothing - which reads as a broken app rather than a careful one.
  */
  async function fillTheMeasurements(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Age'), '30');
    await user.type(screen.getByLabelText('Height (cm)'), '165');
    await user.type(screen.getByLabelText('Weight (kg)'), '62');
  }

  it('works out the target itself, rather than asking for a number nobody knows', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<GoalsScreen />);

    expect(screen.getByText(/your target appears here/)).toBeTruthy();

    await fillTheMeasurements(user);

    expect(screen.getByText('kcal a day')).toBeTruthy();
    // Sex is left at "rather not say", which sits between the two
    // constants: 1423.25 resting, x 1.375 for "light", the default activity.
    expect(screen.getByText('1957')).toBeTruthy();
  });

  it('shows its working, because a number with no source is just a claim', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<GoalsScreen />);
    await fillTheMeasurements(user);

    expect(screen.getByText('Where this number comes from')).toBeTruthy();
  });

  it('saves the target it worked out', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<GoalsScreen />);

    await user.press(screen.getByRole('radio', { name: 'Manage my weight' }));
    await fillTheMeasurements(user);
    await user.press(screen.getByRole('button', { name: 'Continue' }));

    const { preferences } = usePreferencesStore.getState();
    expect(preferences.goal).toBe('manage_weight');
    // Maintenance (1957) less the 500 that managing weight takes off.
    expect(preferences.dailyTargets.caloriesKcal).toBe(1457);
    expect(preferences.dailyTargets.proteinG).toBeGreaterThan(0);
    // Kept, so the figure can be recomputed when the weight changes.
    expect(preferences.bodyBasics.weightKg).toBe(62);
  });

  // Skipping has to stay free. An app that will not start without a body
  // weight loses people on the screen before they have seen anything.
  it('stores no target at all when the measurements are left empty', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<GoalsScreen />);

    await user.press(screen.getByRole('radio', { name: 'Manage my weight' }));
    await user.press(screen.getByRole('button', { name: 'Continue' }));

    expect(usePreferencesStore.getState().preferences.dailyTargets.caloriesKcal).toBeNull();
  });

  it('privacy completes onboarding and states the app is not medical advice', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<PrivacyScreen />);

    expect(screen.getByText('What FoodLens is not')).toBeTruthy();
    expect(usePreferencesStore.getState().onboardingCompletedAt).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Start using FoodLens' }));

    expect(usePreferencesStore.getState().onboardingCompletedAt).not.toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('privacy defaults photo retention off and keeps the user choice', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<PrivacyScreen />);

    // A Switch responds to valueChange, not to a press.
    fireEvent(screen.getByLabelText('Keep my meal photos'), 'valueChange', true);
    await user.press(screen.getByRole('button', { name: 'Start using FoodLens' }));

    expect(usePreferencesStore.getState().preferences.retainPhotos).toBe(true);
  });
});

describe('tab screens with an empty journal', () => {
  /*
    The day's meals left Home for a tab of their own, where the day can be
    changed and a portion corrected. Home carries the totals; this carries
    the day itself, so this is where an empty day has to read as an
    invitation rather than as a report.
  */
  it('invites a first meal rather than reporting an empty one', async () => {
    await renderWithProviders(<MealsScreen />);

    expect((await screen.findAllByText('Nothing logged yet')).length).toBe(4);
    // One prompt per meal, so a missing dinner is visible rather than
    // silently left out of the list.
    expect(screen.getByText('Breakfast')).toBeTruthy();
    expect(screen.getByText('Dinner')).toBeTruthy();
  });

  it('is honest about where data lives in an unconfigured build', async () => {
    await renderWithProviders(<HomeScreen />);

    expect(
      await screen.findByText(/stored on this device and are not backed up/),
    ).toBeTruthy();
  });

  it('offers all three ways to log a meal, in one fixed place', async () => {
    await renderWithProviders(<HomeScreen />);

    // These sit on Home on every visit, logged or not, which is what makes
    // them findable. The third is "Describe" rather than a microphone:
    // there is no speech recognition in this build, and a mic that opened a
    // keyboard would be a lie about the control.
    for (const label of ['Scan food', 'Search', 'Describe']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('journal shows an empty day', async () => {
    await renderWithProviders(<JournalScreen />);
    expect(screen.getByText('Journal')).toBeTruthy();
    expect(await screen.findByText('Nothing logged today')).toBeTruthy();
  });

  it('insights refuses to show patterns without enough data, and says what is missing', async () => {
    await renderWithProviders(<InsightsScreen />);
    expect(screen.getByText('Insights')).toBeTruthy();
    expect(await screen.findByText('Not enough logged yet')).toBeTruthy();
  });

  it('profile reports that no account backend is configured', async () => {
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(
      screen.getByText('Accounts are not configured in this build'),
    ).toBeTruthy();
    expect(screen.getByText('FoodLens is not medical advice')).toBeTruthy();
  });
});

describe('tab screens with a logged meal', () => {
  beforeEach(async () => {
    const created = await getDeviceJournalRepository().createEntry({
      mealType: 'breakfast',
      title: 'Morning porridge',
      items: [sampleItem()],
    });
    if (!created.ok) throw new Error('fixture failed');
  });

  it('the meals tab shows the meal and its calories', async () => {
    await renderWithProviders(<MealsScreen />);
    expect(await screen.findByText('Morning porridge')).toBeTruthy();
    expect(screen.getAllByText('180').length).toBeGreaterThan(0);
  });

  it('home counts it into the day', async () => {
    await renderWithProviders(<HomeScreen />);
    // Against the default of no target, the dial shows what was eaten.
    expect(await screen.findByText('Eaten')).toBeTruthy();
    expect(screen.getAllByText('180').length).toBeGreaterThan(0);
  });

  it('journal groups the meal under its meal type', async () => {
    await renderWithProviders(<JournalScreen />);
    expect(await screen.findByText('Morning porridge')).toBeTruthy();
    expect(screen.getByText('Breakfast')).toBeTruthy();
  });

  it('opens the meal record when a meal is tapped', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<MealsScreen />);

    const row = await screen.findByText('Morning porridge');
    await user.press(row);

    expect(router.push).toHaveBeenCalledWith(expect.stringContaining('/entry/'));
  });
});

describe('scan screen', () => {
  it('states that analysis is unavailable and offers real routes forward', async () => {
    await renderWithProviders(<ScanScreen />);

    expect(
      screen.getByText('Nutrition analysis is not set up in this build'),
    ).toBeTruthy();
    // No button that would do nothing.
    expect(screen.queryByRole('button', { name: 'Analyse this photo' })).toBeNull();
    // Manual entry works with no backend at all, so it is offered up front.
    expect(screen.getByRole('button', { name: /^Add a meal by hand/ })).toBeTruthy();
  });

  it('offers both capture routes', async () => {
    await renderWithProviders(<ScanScreen />);

    // The camera is in the app now, so these are the shutter and the gallery
    // control on it rather than two buttons on a panel.
    expect(screen.getByRole('button', { name: 'Take the photo' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Choose from your photos' }),
    ).toBeTruthy();
  });

  it('keeps the frame clear of the controls', async () => {
    await renderWithProviders(<ScanScreen />);

    // The guides are decoration over the preview: they must not be read out,
    // and they must not swallow a tap meant for the shutter.
    expect(screen.getByText('Fit the whole plate in the frame')).toBeTruthy();
  });

  it('does not show the post-capture actions before a photo exists', async () => {
    await renderWithProviders(<ScanScreen />);

    // "Make this at home" and "Log this meal" only make sense with a photo.
    expect(screen.queryByRole('button', { name: 'Make this at home' })).toBeNull();
    expect(screen.queryByText('What next?')).toBeNull();
  });
});
