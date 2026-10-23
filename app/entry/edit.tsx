import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { ErrorState, Screen, Skeleton } from '@/components/ui';
import { bumpJournalRevision, useJournalRepository } from '@/features/journal';
import { MealEditor, type MealDraft } from '@/features/journal/MealEditor';
import { deleteMealPhoto, mealPhotoUri, saveMealPhoto } from '@/features/photos';
import { ok, type AppError } from '@/lib/result';
import { useAsyncResult } from '@/lib/useAsyncResult';
import { usePreferencesStore } from '@/store/preferencesStore';
import type { FoodEntry } from '@/types/domain';

/**
 * Editing a saved meal.
 *
 * Split out from the meal record, which now reads rather than edits. Opening
 * a meal should answer "was that any good"; changing it is a deliberate
 * second step, and one that deserves a screen with a Save button on it
 * rather than a set of fields that quietly commit.
 */
export default function EditEntryScreen() {
  const router = useRouter();
  const repository = useJournalRepository();
  const { id } = useLocalSearchParams<{ id: string }>();
  const retainPhotos = usePreferencesStore((state) => state.preferences.retainPhotos);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<AppError | null>(null);

  const { data: entry, loading, error } = useAsyncResult<FoodEntry | null>(
    async () => (id ? repository.getEntry(id) : ok(null)),
    [id, repository],
  );

  const save = async (draft: MealDraft) => {
    if (!entry) return;
    setSaving(true);
    setSaveError(null);

    const result = await repository.updateEntry(entry.id, {
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

    // Removing the photo in the editor has to remove the file too, or it
    // comes back the next time the meal is opened.
    if (draft.photoUri === null) {
      deleteMealPhoto(entry.id);
    } else if (retainPhotos && draft.photoUri !== mealPhotoUri(entry.id)) {
      await saveMealPhoto(entry.id, draft.photoUri);
    }

    setSaving(false);
    bumpJournalRevision();
    router.back();
  };

  const remove = async () => {
    if (!entry) return;
    setSaving(true);
    const result = await repository.deleteEntry(entry.id);
    setSaving(false);

    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    deleteMealPhoto(entry.id);
    bumpJournalRevision();
    // Back twice: the record this came from is showing a meal that no longer
    // exists, and landing on it would be an error screen the user caused.
    router.dismissAll();
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} />
        <Skeleton height={48} />
        <Skeleton height={120} />
      </Screen>
    );
  }

  if (error || !entry) {
    return (
      <Screen>
        <ErrorState
          message={error?.message ?? 'We could not open this meal.'}
          detail={error?.detail}
          onRetry={() => router.back()}
          retryLabel="Go back"
        />
      </Screen>
    );
  }

  return (
    <MealEditor
      mode="edit"
      initial={entry}
      initialPhotoUri={mealPhotoUri(entry.id)}
      saving={saving}
      saveError={saveError}
      onSave={(draft) => void save(draft)}
      onDelete={() => void remove()}
    />
  );
}
