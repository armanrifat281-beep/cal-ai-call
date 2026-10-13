import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, ErrorState, Screen, Skeleton, Text } from '@/components/ui';
import { MealActions, useJournalRepository } from '@/features/journal';
import { MealEditor, type MealDraft } from '@/features/journal/MealEditor';
import { deleteMealPhoto, mealPhotoUri, saveMealPhoto } from '@/features/photos';
import { formatDayLabel, toDateKey, todayKey } from '@/lib/date';
import { ok, type AppError } from '@/lib/result';
import { useAsyncResult } from '@/lib/useAsyncResult';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import type { FoodEntry } from '@/types/domain';

/** View, edit, duplicate or delete one saved meal. */
export default function EntryDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const repository = useJournalRepository();
  const { id } = useLocalSearchParams<{ id: string }>();
  const retainPhotos = usePreferencesStore((state) => state.preferences.retainPhotos);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<AppError | null>(null);

  const {
    data: entry,
    loading,
    error: loadError,
    reload: load,
  } = useAsyncResult<FoodEntry | null>(
    async () => (id ? repository.getEntry(id) : ok(null)),
    [id, repository],
  );

  // A read that succeeded and came back with nothing means the meal is gone,
  // which is a different screen from a read that failed.
  const notFound = !loading && loadError === null && entry === null;

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
    // Deleting the meal deletes its picture: a photo with no entry to belong
    // to is just a file the user cannot see or remove.
    deleteMealPhoto(entry.id);
    router.back();
  };

  const logAgain = async () => {
    if (!entry) return;
    setSaving(true);
    setSaveError(null);
    const result = await repository.duplicateEntry(entry.id, {});
    setSaving(false);

    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    router.back();
  };

  if (loading) {
    return (
      <Screen contentStyle={{ gap: theme.spacing.base }}>
        <Skeleton height={120} radius={theme.radius.surface} />
        <Skeleton height={48} />
        <Skeleton height={48} />
        <Skeleton height={96} radius={theme.radius.surface} />
      </Screen>
    );
  }

  if (notFound) {
    return (
      <Screen>
        <ErrorState
          title="Meal not found"
          message="This meal is no longer in your journal. It may have been deleted."
          onRetry={() => router.back()}
          retryLabel="Go back"
        />
      </Screen>
    );
  }

  if (loadError || !entry) {
    return (
      <Screen>
        <ErrorState
          message={loadError?.message ?? 'We could not open this meal.'}
          detail={loadError?.detail}
          onRetry={load}
        />
      </Screen>
    );
  }

  const isFromAnotherDay = toDateKey(new Date(entry.consumedAt)) !== todayKey();

  return (
    <>
      {/*
        The title is the meal's name, set declaratively rather than pushed
        from an effect: the navigator reads it during the same render the
        meal arrives in, so there is no frame showing the placeholder.
      */}
      <Stack.Screen options={{ title: entry.title }} />
      <MealEditor
        mode="edit"
        initial={entry}
        initialPhotoUri={mealPhotoUri(entry.id)}
        saving={saving}
        saveError={saveError}
        onSave={(draft) => void save(draft)}
        onDelete={() => void remove()}
        extras={
          <MealActions
            title={entry.title}
            mealType={entry.mealType}
            items={entry.items}
            // The meal is already in the journal, so a shortcut to it makes
            // sense here in a way it would not on an unsaved draft.
            allowSaving
          />
        }
        banner={
          isFromAnotherDay ? (
            <View
              style={{
                gap: theme.spacing.sm,
                padding: theme.spacing.base,
                borderRadius: theme.radius.surface,
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Text variant="label" color="primaryOnSoft">
                Saved on {formatDayLabel(toDateKey(new Date(entry.consumedAt)))}
              </Text>
              <Text variant="caption" color="primaryOnSoft">
                Copy it to today instead of editing this one, and the original
                stays where it is.
              </Text>
              <Button
                label="Log this again today"
                variant="tonal"
                size="sm"
                onPress={() => void logAgain()}
                leading={<Icon name="copy" size={16} color="text" />}
              />
            </View>
          ) : null
        }
      />
    </>
  );
}
