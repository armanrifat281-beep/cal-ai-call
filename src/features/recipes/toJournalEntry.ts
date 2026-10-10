import { newId } from '@/lib/id';
import { EMPTY_NUTRIENTS, type FoodEntryItem } from '@/types/domain';
import type { Recipe } from '@/types/recipe';

/**
 * Turning a cooked recipe into a journal entry.
 *
 * The two halves of the app knew nothing about each other: a recipe carried
 * per-serving nutrition, the user cooked and ate it, and then had to type
 * the same numbers into the journal by hand.
 *
 * The important part is provenance. A recipe's figures are usually a model's
 * estimate, and they stay labelled as one in the journal. Copying them in as
 * `user_entered` would launder an estimate into something the user appears
 * to have measured, which is exactly the distinction this app exists to
 * keep.
 */

export interface RecipeServingInput {
  recipe: Recipe;
  /** How many servings of it the user actually ate. */
  servingsEaten: number;
}

/**
 * One journal item for the servings eaten, or null when the recipe has no
 * nutrition to log.
 *
 * Null rather than zeroes: a recipe with unknown nutrition is common and
 * honest, and logging it as 0 kcal would be a lie the daily total believes.
 */
export function recipeToJournalItem({
  recipe,
  servingsEaten,
}: RecipeServingInput): FoodEntryItem | null {
  const perServing = recipe.nutritionPerServing;
  if (!perServing) return null;

  const servings = Math.max(0.25, servingsEaten);

  return {
    id: newId(),
    name: recipe.title,
    brand: null,
    portion: { quantity: servings, unit: 'serving' },
    // A serving is not a weight, and the recipe does not say what one
    // weighs. Claiming a gram figure here would be inventing one.
    gramsResolved: null,
    nutrients: {
      ...EMPTY_NUTRIENTS,
      caloriesKcal: perServing.caloriesKcal * servings,
      proteinG: perServing.proteinG * servings,
      carbsG: perServing.carbsG * servings,
      fatG: perServing.fatG * servings,
    },
    provenance: {
      // Carried straight from the recipe, never upgraded.
      source: perServing.source,
      confidence: perServing.source === 'user_entered' ? 'high' : 'low',
      providerLabel: perServing.providerLabel,
      providerRef: null,
    },
    foodRecordId: null,
    notes: null,
  };
}

/** What to call the entry. The dish, as the user knows it. */
export function recipeEntryTitle(recipe: Recipe): string {
  return recipe.title;
}
