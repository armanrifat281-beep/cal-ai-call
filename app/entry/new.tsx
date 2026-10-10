import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { useJournalRepository } from '@/features/journal';
import { MealEditor, type MealDraft } from '@/features/journal/MealEditor';
import { saveMealPhoto } from '@/features/photos';
import type { AppError } from '@/lib/result';
import { usePreferencesStore } from '@/store/preferencesStore';
import { MEAL_TYPES, type MealType } from '@/types/domain';

/**
 * Manual meal entry.
 *
 * Fully functional with no backend and no AI: this is the path that guarantees
 * the journal is usable on day one.
 *
 * It also receives the scanner's photo. The capture lives in the cache
 * directory, which the system can clear, so it is copied somewhere durable
 * only once the entry exists and has an id to file it under - and only when
 * the user has asked for photos to be kept.
 */
export default function NewEntryScreen() {
  const router = useRouter();
  const repository = useJournalRepository();
  const params = useLocalSearchParams<{ mealType?: string; photoUri?: string }>();
  const retainPhotos = usePreferencesStore((state) => state.preferences.retainPhotos);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<AppError | null>(null);

  const presetMealType = isMealType(params.mealType) ? params.mealType : undefined;

  const save = async (draft: MealDraft) => {
    setSaving(true);
    setSaveError(null);

    const result = await repository.createEntry({
      consumedAt: draft.consumedAt,
      mealType: draft.mealType,
      title: draft.title,
      items: draft.items,
      notes: draft.notes,
    });

    if (!result.ok) {
      setSaving(false);
      setSaveError(result.error);
      return;
    }

    // The meal is saved either way: a photo that fails to copy is worth a
    // missing picture, never a lost entry, so this does not surface an error.
    if (draft.photoUri && retainPhotos) {
      await saveMealPhoto(result.value.id, draft.photoUri);
    }

    setSaving(false);
    router.back();
  };

  return (
    <MealEditor
      mode="create"
      initial={presetMealType ? { mealType: presetMealType } : undefined}
      initialPhotoUri={params.photoUri ?? null}
      saving={saving}
      saveError={saveError}
      onSave={(draft) => void save(draft)}
    />
  );
}

function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && (MEAL_TYPES as readonly string[]).includes(value);
}
