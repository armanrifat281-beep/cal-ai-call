import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  BodyBasics,
  DailyTargets,
  DietaryPattern,
  MeasurementSystem,
  NutritionGoalKind,
  UserPreferences,
} from '@/types/domain';

/**
 * Preferences and onboarding state.
 *
 * Stored on the device so the app is usable before (and without) an account.
 * Once the user signs in, `syncedAt` lets us push this up to Supabase and then
 * treat the server as the source of truth.
 */

/** Device-side preferences: everything in UserPreferences we own locally. */
export type LocalPreferences = Omit<UserPreferences, 'userId' | 'updatedAt'>;

export const DEFAULT_PREFERENCES: LocalPreferences = {
  displayName: null,
  language: 'en',
  countryCode: null,
  measurementSystem: 'metric',
  dietaryPatterns: [],
  allergens: [],
  pantryItems: [],
  allergyAwarenessEnabled: false,
  dislikedFoods: [],
  favoriteCuisines: [],
  goal: 'none',
  dailyTargets: { caloriesKcal: null, proteinG: null, carbsG: null, fatG: null },
  waterTargetMl: null,
  bodyBasics: {
    sex: 'unspecified',
    ageYears: null,
    heightCm: null,
    weightKg: null,
    activity: 'light',
  },
  preferredServings: 4,
  favoriteCuisineId: null,
  foodMemoryEnabled: true,
  retainPhotos: false,
};

interface PreferencesState {
  /** False until the persisted state has been read from disk. */
  hydrated: boolean;
  preferences: LocalPreferences;
  /** ISO instant onboarding finished, or null if it has not. */
  onboardingCompletedAt: string | null;
  /** ISO instant these preferences were last pushed to the server. */
  syncedAt: string | null;

  setPreferences: (partial: Partial<LocalPreferences>) => void;
  toggleDietaryPattern: (pattern: DietaryPattern) => void;
  setMeasurementSystem: (system: MeasurementSystem) => void;
  setGoal: (goal: NutritionGoalKind) => void;
  setDailyTargets: (targets: Partial<DailyTargets>) => void;
  /** Height, weight and activity, for working out a calorie target. */
  setBodyBasics: (basics: Partial<BodyBasics>) => void;
  setAllergens: (allergens: string[]) => void;
  /** What the user has at home, for "cook with what I have". */
  setPantryItems: (items: string[]) => void;
  completeOnboarding: () => void;
  markSynced: (at?: string) => void;
  /** Clears everything. Used by sign-out and account deletion. */
  reset: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      preferences: DEFAULT_PREFERENCES,
      onboardingCompletedAt: null,
      syncedAt: null,

      setPreferences: (partial) =>
        set((state) => ({
          preferences: { ...state.preferences, ...partial },
          syncedAt: null,
        })),

      toggleDietaryPattern: (pattern) =>
        set((state) => {
          const current = state.preferences.dietaryPatterns;
          const next = current.includes(pattern)
            ? current.filter((p) => p !== pattern)
            : [...current, pattern];
          return {
            preferences: { ...state.preferences, dietaryPatterns: next },
            syncedAt: null,
          };
        }),

      setMeasurementSystem: (system) =>
        set((state) => ({
          preferences: { ...state.preferences, measurementSystem: system },
          syncedAt: null,
        })),

      setGoal: (goal) =>
        set((state) => ({
          preferences: { ...state.preferences, goal },
          syncedAt: null,
        })),

      setDailyTargets: (targets) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            dailyTargets: { ...state.preferences.dailyTargets, ...targets },
          },
          syncedAt: null,
        })),

      setBodyBasics: (basics) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            bodyBasics: { ...state.preferences.bodyBasics, ...basics },
          },
          syncedAt: null,
        })),

      setPantryItems: (items) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            // Trimmed and de-duplicated here rather than at each call site:
            // the list is typed by hand, so "Rice" and "rice " arrive as two
            // items and would be matched against a recipe twice.
            pantryItems: Array.from(
              new Map(
                items
                  .map((item) => item.trim())
                  .filter((item) => item.length > 0)
                  .map((item) => [item.toLowerCase(), item]),
              ).values(),
            ),
          },
          syncedAt: null,
        })),

      setAllergens: (allergens) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            allergens,
            // Listing an allergen implies wanting it respected in suggestions.
            allergyAwarenessEnabled:
              allergens.length > 0 ? true : state.preferences.allergyAwarenessEnabled,
          },
          syncedAt: null,
        })),

      completeOnboarding: () => {
        if (get().onboardingCompletedAt) return;
        set({ onboardingCompletedAt: new Date().toISOString() });
      },

      markSynced: (at) => set({ syncedAt: at ?? new Date().toISOString() }),

      reset: () =>
        set({
          preferences: DEFAULT_PREFERENCES,
          onboardingCompletedAt: null,
          syncedAt: null,
        }),
    }),
    {
      name: 'foodlens.preferences.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // `hydrated` is runtime-only: it must never be read back from disk.
      partialize: ({ preferences, onboardingCompletedAt, syncedAt }) => ({
        preferences,
        onboardingCompletedAt,
        syncedAt,
      }),
      /*
        Fills in anything the stored copy predates.

        Zustand's default merge is shallow, so a stored `preferences` object
        REPLACES the defaults wholesale rather than filling the gaps in them.
        Every field added after a user's last save therefore arrived as
        `undefined` - and the first screen to read `.length` on one crashed.

        That is exactly what `pantryItems` did: it was added to the defaults,
        and on every phone that already had preferences saved it came back
        undefined, so Discover, the recipe screen and Profile all threw.

        Merging level by level means a field added tomorrow lands on its
        default instead, and no future addition can repeat this.
      */
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<PreferencesState>;

        return {
          ...current,
          ...stored,
          preferences: {
            ...current.preferences,
            ...(stored.preferences ?? {}),
            // Nested, so it needs the same treatment for the same reason.
            dailyTargets: {
              ...current.preferences.dailyTargets,
              ...(stored.preferences?.dailyTargets ?? {}),
            },
            bodyBasics: {
              ...current.preferences.bodyBasics,
              ...(stored.preferences?.bodyBasics ?? {}),
            },
          },
        };
      },
      // Runs after persisted state is applied, and also when reading it
      // failed, so the app never waits forever on a bad storage read.
      onRehydrateStorage: () => () => {
        usePreferencesStore.setState({ hydrated: true });
      },
    },
  ),
);

/** Selector helpers keep components from re-rendering on unrelated changes. */
export const selectPreferences = (s: PreferencesState) => s.preferences;
export const selectMeasurementSystem = (s: PreferencesState) =>
  s.preferences.measurementSystem;
export const selectDailyTargets = (s: PreferencesState) => s.preferences.dailyTargets;
export const selectHasOnboarded = (s: PreferencesState) =>
  s.onboardingCompletedAt !== null;
