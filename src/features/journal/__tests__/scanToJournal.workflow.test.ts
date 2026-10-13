import AsyncStorage from '@react-native-async-storage/async-storage';

import { analysisToEntryItems } from '@/features/scanner/toEntryItems';
import { analyzeMealPhoto } from '@/features/scanner/service';
import { summarizeEntries } from '@/features/nutrition';
import { todayKey } from '@/lib/date';

import { clearLocalJournal, createLocalJournalRepository } from '../localRepository';

/**
 * The one workflow the app exists for, end to end.
 *
 * Photograph a meal -> the server names the foods -> the names become journal
 * items -> the meal is saved -> the app is closed and reopened -> the meal is
 * still there -> it opens, and a correction to it sticks.
 *
 * Every link in that chain already had its own unit test. None of them
 * proved the links were *joined*: a field renamed on one side of a seam
 * passes both unit tests and loses the user's meal. That is what this
 * covers, and it is the reason it starts from an HTTP response body rather
 * than from a hand-built `MealAnalysis`.
 *
 * "Closed and reopened" is a second repository instance. Nothing is carried
 * over in memory, so anything that survives came back out of storage.
 */

jest.mock('expo-file-system', () => ({
  // Jest hoists `jest.mock`, so this is declared inside the factory.
  File: jest.fn((uri: string) => ({
    uri,
    name: 'meal.jpg',
    type: 'image/jpeg',
    bytes: () => Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff])),
  })),
}));

jest.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://project.supabase.co',
    supabaseKey: 'sb_publishable_test',
    isSupabaseConfigured: true,
  },
}));

const mockFetch = jest.fn();

/** What analyze-meal actually answers for a plate of rice and chicken. */
const SERVER_RESPONSE = {
  foods: [
    {
      name: 'Steamed rice',
      confidence: 'high',
      portion: { quantity: 1, unit: 'cup' },
      estimatedGrams: 158,
      estimatedNutrients: {
        caloriesKcal: 205,
        proteinG: 4.3,
        carbsG: 45,
        fatG: 0.4,
      },
    },
    {
      name: 'Grilled chicken breast',
      confidence: 'medium',
      portion: { quantity: 120, unit: 'g' },
      estimatedGrams: 120,
      estimatedNutrients: {
        caloriesKcal: 198,
        proteinG: 37,
        carbsG: 0,
        fatG: 4.3,
      },
    },
  ],
  suggestedTitle: 'Rice and grilled chicken',
  suggestedMealType: 'lunch',
  providerLabel: 'gemini-3-flash-preview',
};

const PHOTO = {
  imageUri: 'file:///tmp/meal.jpg',
  mimeType: 'image/jpeg',
  localHour: 13,
  retainPhoto: false,
  accessToken: 'token-123',
  fallbackMealType: 'lunch' as const,
};

beforeEach(async () => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  await clearLocalJournal();
  await AsyncStorage.clear();
});

describe('photograph a meal, save it, and find it again', () => {
  it('carries the analysis through to a saved entry that survives a restart', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => SERVER_RESPONSE,
    });

    // ---- 1. Scan -----------------------------------------------------------
    const analysed = await analyzeMealPhoto(PHOTO);
    expect(analysed.ok).toBe(true);
    if (!analysed.ok) return;

    const analysis = analysed.value;
    expect(analysis.foods).toHaveLength(2);

    // ---- 2. Analysis becomes journal items ---------------------------------
    const items = analysisToEntryItems(analysis);
    expect(items.map((item) => item.name)).toEqual([
      'Steamed rice',
      'Grilled chicken breast',
    ]);

    /*
      The app's central claim: a figure a model guessed is labelled as a
      guess. If this ever silently became `database`, the confidence bar
      would tell the user their day was measured when it was estimated.
    */
    expect(items.every((item) => item.provenance.source === 'ai_estimate')).toBe(true);

    // ---- 3. Save -----------------------------------------------------------
    const saving = createLocalJournalRepository();
    const created = await saving.createEntry({
      mealType: analysis.suggestedMealType,
      title: analysis.suggestedTitle,
      items,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const entryId = created.value.id;

    // ---- 4. Close and reopen the app ---------------------------------------
    // A new instance: nothing is shared with the one that wrote the entry,
    // so whatever comes back came out of storage.
    const reopened = createLocalJournalRepository();

    const day = await reopened.listEntriesForDay(todayKey());
    expect(day.ok).toBe(true);
    if (!day.ok) return;

    expect(day.value).toHaveLength(1);
    expect(day.value[0]?.title).toBe('Rice and grilled chicken');

    // ---- 5. The day's totals come from the saved entry ---------------------
    const summary = summarizeEntries(day.value);
    // 205 + 198, from the two foods above.
    expect(Math.round(summary.totals.nutrients.caloriesKcal)).toBe(403);
    expect(Math.round(summary.totals.nutrients.proteinG)).toBe(41);

    // ---- 6. Reopen the meal itself -----------------------------------------
    const fetched = await reopened.getEntry(entryId);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    expect(fetched.value?.items).toHaveLength(2);
    expect(fetched.value?.items[1]?.provenance.providerLabel).toBe(
      'gemini-3-flash-preview',
    );
  });

  it('keeps a correction to a portion, which is the point of correcting it', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => SERVER_RESPONSE,
    });

    const analysed = await analyzeMealPhoto(PHOTO);
    if (!analysed.ok) throw new Error('the scan should have succeeded');

    const items = analysisToEntryItems(analysed.value);
    const writing = createLocalJournalRepository();
    const created = await writing.createEntry({
      mealType: 'lunch',
      title: 'Rice and grilled chicken',
      items,
    });
    if (!created.ok) throw new Error('the save should have succeeded');

    // The user says it was half the rice.
    const corrected = items.map((item, index) =>
      index === 0
        ? {
            ...item,
            portion: { quantity: 0.5, unit: item.portion.unit },
            gramsResolved: 79,
            nutrients: { ...item.nutrients, caloriesKcal: 103 },
            // Their own figure, no longer the model's.
            provenance: { ...item.provenance, source: 'user_entered' as const },
          }
        : item,
    );

    const updated = await writing.updateEntry(created.value.id, { items: corrected });
    expect(updated.ok).toBe(true);

    const afterRestart = createLocalJournalRepository();
    const fetched = await afterRestart.getEntry(created.value.id);
    if (!fetched.ok || !fetched.value) throw new Error('the meal should still be there');

    expect(fetched.value.items[0]?.nutrients.caloriesKcal).toBe(103);
    expect(fetched.value.items[0]?.provenance.source).toBe('user_entered');
    // The food the user did not touch keeps its own provenance.
    expect(fetched.value.items[1]?.provenance.source).toBe('ai_estimate');
  });

  it('deletes a meal for good, rather than hiding it from one screen', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => SERVER_RESPONSE,
    });

    const analysed = await analyzeMealPhoto(PHOTO);
    if (!analysed.ok) throw new Error('the scan should have succeeded');

    const writing = createLocalJournalRepository();
    const created = await writing.createEntry({
      mealType: 'lunch',
      title: 'Rice and grilled chicken',
      items: analysisToEntryItems(analysed.value),
    });
    if (!created.ok) throw new Error('the save should have succeeded');

    expect((await writing.deleteEntry(created.value.id)).ok).toBe(true);

    const afterRestart = createLocalJournalRepository();
    const day = await afterRestart.listEntriesForDay(todayKey());
    if (!day.ok) throw new Error('the day should still read');

    expect(day.value).toHaveLength(0);
  });

  /*
    A failed analysis must not leave a half-made entry behind. The journal is
    the record the user trusts; a meal they never confirmed appearing in it
    would be worse than the failure itself.
  */
  it('writes nothing to the journal when the analysis fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      clone: () => ({
        json: async () => ({
          error: { code: 'provider_error', message: 'The analysis service had a problem.' },
        }),
      }),
    });

    const analysed = await analyzeMealPhoto(PHOTO);
    expect(analysed.ok).toBe(false);

    const day = await createLocalJournalRepository().listEntriesForDay(todayKey());
    if (!day.ok) throw new Error('the day should still read');
    expect(day.value).toHaveLength(0);
  });
});
