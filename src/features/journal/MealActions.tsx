import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, ErrorState, Surface, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import type { AppError } from '@/lib/result';
import type { FoodEntryItem, MealType } from '@/types/domain';

import { useJournalRepository } from './hooks';

/**
 * What else a meal is good for, once it has been identified.
 *
 * Two things people actually want after analysing a plate, neither of which
 * is editing it again:
 *
 *   - Save it, so tomorrow's identical breakfast takes one tap instead of a
 *     photograph and a correction. This is what fills the journal's quick-add
 *     rail; without it that rail would stay empty forever.
 *   - Cook it, taking the foods the analyser named straight into the recipe
 *     creator as the things on hand.
 *
 * Secondary by design: they sit at the end of the form, not in the sticky
 * footer, which belongs to the one decision the screen exists for.
 */
export interface MealActionsProps {
  /** The name a saved copy is stored under. */
  title: string;
  mealType: MealType | null;
  items: readonly FoodEntryItem[];
  /**
   * Offer saving the meal for re-use.
   *
   * Off while the meal itself is unsaved: saving a shortcut to something that
   * is not in the journal yet would be a confusing order to do things in.
   */
  allowSaving?: boolean;
}

/** The foods by name, for the recipe creator's "what I have" field. */
function ingredientList(items: readonly FoodEntryItem[]): string {
  return items
    .map((item) => item.name.trim())
    .filter((name) => name.length > 0)
    .join(', ');
}

export function MealActions({
  title,
  mealType,
  items,
  allowSaving = false,
}: MealActionsProps) {
  const theme = useTheme();
  const router = useRouter();
  const repository = useJournalRepository();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const ingredients = ingredientList(items);

  // No foods means nothing to save and nothing to cook with.
  if (ingredients.length === 0) return null;

  const saveForReuse = async () => {
    setSaving(true);
    setError(null);

    const result = await repository.createSavedMeal({
      name: title.trim().length > 0 ? title.trim() : 'Saved meal',
      mealType,
      items: [...items],
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  };

  return (
    <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.md }}>
      <Text variant="label" color="textMuted">
        DO MORE WITH THIS MEAL
      </Text>

      {error ? <ErrorState message={error.message} detail={error.detail} /> : null}

      <View style={{ gap: theme.spacing.sm }}>
        {allowSaving ? (
          <Button
            label={saved ? 'Saved for quick add' : 'Save for quick add'}
            variant="tonal"
            // Saving twice would leave two identical shortcuts with no way to
            // tell them apart.
            disabled={saved}
            loading={saving}
            onPress={() => void saveForReuse()}
            leading={
              <Icon name={saved ? 'check' : 'star'} size={16} color="text" />
            }
            fullWidth
          />
        ) : null}

        <Button
          label="Cook something with these"
          variant="tonal"
          onPress={() =>
            router.push(
              `/recipe/create?mode=from_pantry&pantry=${encodeURIComponent(ingredients)}`,
            )
          }
          leading={<Icon name="recipes" size={16} color="text" />}
          fullWidth
        />
      </View>

      {saved ? (
        <Text variant="caption" color="textMuted" accessibilityLiveRegion="polite">
          It will appear under Quick add in your journal.
        </Text>
      ) : null}
    </Surface>
  );
}
