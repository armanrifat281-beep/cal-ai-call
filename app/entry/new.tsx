import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { useJournalRepository } from '@/features/journal';
import { MealEditor, type MealDraft } from '@/features/journal/MealEditor';
import type { AppError } from '@/lib/result';
import { MEAL_TYPES, type MealType } from '@/types/domain';

/**
 * Manual meal entry.
 *
 * Fully functional with no backend and no AI: this is the path that guarantees
 * the journal is usable on day one.
 */
export default function NewEntryScreen() {
  const router = useRouter();
  const repository = useJournalRepository();
  const params = useLocalSearchParams<{ mealType?: string }>();

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

    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    router.back();
  };

  return (
    <MealEditor
      mode="create"
      initial={presetMealType ? { mealType: presetMealType } : undefined}
      saving={saving}
      saveError={saveError}
      onSave={(draft) => void save(draft)}
    />
  );
}

function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && (MEAL_TYPES as readonly string[]).includes(value);
}
