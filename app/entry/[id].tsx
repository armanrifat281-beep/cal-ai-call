import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, ErrorState, Screen, Skeleton, Text } from '@/components/ui';
import { useJournalRepository } from '@/features/journal';
import { MealEditor, type MealDraft } from '@/features/journal/MealEditor';
import { formatDayLabel, toDateKey, todayKey } from '@/lib/date';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';
import type { FoodEntry } from '@/types/domain';

/** View, edit, duplicate or delete one saved meal. */
export default function EntryDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const repository = useJournalRepository();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [entry, setEntry] = useState<FoodEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<AppError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<AppError | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);

    const result = await repository.getEntry(id);
    setLoading(false);

    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    if (!result.value) {
      setNotFound(true);
      return;
    }
    setEntry(result.value);
  }, [id, repository]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (entry) navigation.setOptions({ title: entry.title });
  }, [entry, navigation]);

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

    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
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
        <Skeleton height={120} radius={theme.radius.lg} />
        <Skeleton height={48} />
        <Skeleton height={48} />
        <Skeleton height={96} radius={theme.radius.lg} />
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
          onRetry={() => void load()}
        />
      </Screen>
    );
  }

  const isFromAnotherDay = toDateKey(new Date(entry.consumedAt)) !== todayKey();

  return (
    <MealEditor
      mode="edit"
      initial={entry}
      saving={saving}
      saveError={saveError}
      onSave={(draft) => void save(draft)}
      onDelete={() => void remove()}
      banner={
        isFromAnotherDay ? (
          <View
            style={{
              gap: theme.spacing.sm,
              padding: theme.spacing.base,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.primarySoft,
            }}
          >
            <Text variant="bodySmStrong" color="primaryOnSoft">
              Saved on {formatDayLabel(toDateKey(new Date(entry.consumedAt)))}
            </Text>
            <Text variant="caption" color="primaryOnSoft">
              Copy it to today instead of editing this one, and the original stays
              where it is.
            </Text>
            <Button
              label="Log this again today"
              variant="secondary"
              size="sm"
              onPress={() => void logAgain()}
              leading={<Icon name="copy" size={16} color="text" />}
            />
          </View>
        ) : null
      }
    />
  );
}
