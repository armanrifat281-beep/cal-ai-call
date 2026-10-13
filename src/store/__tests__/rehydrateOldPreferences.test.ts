import AsyncStorage from '@react-native-async-storage/async-storage';

import { usePreferencesStore } from '../preferencesStore';

const STORAGE_KEY = 'foodlens.preferences.v1';

/**
 * Preferences saved by an older build of the app.
 *
 * Deliberately missing `pantryItems`, and missing `fatG` inside the nested
 * targets: both were added after a real user had already saved this shape.
 */
const OLD_SAVED_STATE = {
  state: {
    preferences: {
      displayName: 'Someone',
      language: 'en',
      countryCode: 'BD',
      measurementSystem: 'metric',
      dietaryPatterns: [],
      allergens: [],
      allergyAwarenessEnabled: false,
      dislikedFoods: [],
      favoriteCuisines: [],
      goal: 'none',
      dailyTargets: { caloriesKcal: 2000, proteinG: 120, carbsG: 250 },
      preferredServings: 2,
      favoriteCuisineId: null,
      foodMemoryEnabled: true,
      retainPhotos: false,
    },
    onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
    syncedAt: null,
  },
  version: 0,
};

/**
 * Opening the app with preferences saved by an older build.
 *
 * This is the crash the user actually hit: "Cannot read property 'length' of
 * undefined", thrown from a `useMemo` on every screen that read the new
 * field. Zustand's default merge is shallow, so the stored `preferences`
 * object replaced the defaults instead of filling the gaps in them, and
 * anything added since the last save came back `undefined`.
 */
describe('preferences saved by an older build', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePreferencesStore.getState().reset();
  });

  it('fills in a field that did not exist when they were saved', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(OLD_SAVED_STATE));
    await usePreferencesStore.persist.rehydrate();

    const { preferences } = usePreferencesStore.getState();

    // The crash: `pantryItems.length` on an undefined value.
    expect(preferences.pantryItems).toEqual([]);
    expect(() => preferences.pantryItems.length).not.toThrow();
  });

  it('fills a gap inside a nested object too', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(OLD_SAVED_STATE));
    await usePreferencesStore.persist.rehydrate();

    const { dailyTargets } = usePreferencesStore.getState().preferences;

    expect(dailyTargets.caloriesKcal).toBe(2000);
    // Absent from the saved copy, so it must come from the defaults.
    expect(dailyTargets.fatG).not.toBeUndefined();
  });

  it('keeps everything the user had actually set', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(OLD_SAVED_STATE));
    await usePreferencesStore.persist.rehydrate();

    const state = usePreferencesStore.getState();

    expect(state.preferences.displayName).toBe('Someone');
    expect(state.preferences.countryCode).toBe('BD');
    expect(state.preferences.preferredServings).toBe(2);
    expect(state.onboardingCompletedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('survives storage holding nothing useful at all', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state: {}, version: 0 }));
    await usePreferencesStore.persist.rehydrate();

    const { preferences } = usePreferencesStore.getState();

    expect(preferences.pantryItems).toEqual([]);
    expect(preferences.dailyTargets.caloriesKcal).not.toBeUndefined();
  });
});
