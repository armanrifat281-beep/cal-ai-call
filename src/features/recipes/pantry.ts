import type { RecipeIngredient } from '@/types/recipe';

/**
 * Which of a recipe's ingredients the user actually has.
 *
 * The honest half of "cook with what you have". Telling someone a recipe is
 * within reach when it needs two things they do not own wastes a trip to the
 * shop; the useful answer is the list of what is missing, which is what this
 * produces.
 *
 * Matching is deliberately literal. The pantry is free text - people keep
 * "half a cabbage" and "that jar of paste" - so there is no vocabulary to
 * match against, and a clever matcher would guess. A guess that says the
 * user HAS an ingredient is the expensive direction to be wrong in: they
 * discover it at the stove, halfway through. A guess that says they do not
 * costs them a glance at their own shelf. So the rule is one-sided: a match
 * has to be a whole word, and everything else is reported as missing.
 *
 * What it therefore gets wrong, on purpose:
 *   - "scallion" against a pantry of "spring onions" reads as missing.
 *   - "chicken thighs" against "chicken" reads as present, because one
 *     contains the other as a whole word.
 *
 * The second is the risk worth accepting: a pantry entry is something the
 * user typed because they have it, and a recipe ingredient that contains it
 * as a whole word is almost always the same food.
 */
export interface PantryMatch {
  /** Ingredients matched to something in the pantry. */
  available: RecipeIngredient[];
  /** Ingredients with nothing in the pantry to match. */
  missing: RecipeIngredient[];
}

/**
 * Lower-cased words, with plurals and punctuation flattened.
 *
 * Only the simple English plural is handled, because anything more is a
 * stemmer, and a stemmer on free text produces matches nobody can predict.
 */
function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .map((word) => (word.endsWith('es') && word.length > 4
      ? word.slice(0, -2)
      : word.endsWith('s') && !word.endsWith('ss') && word.length > 3
        ? word.slice(0, -1)
        : word));
}

/**
 * Noise words that must never carry a match on their own.
 *
 * Without this, a pantry entry of "olive oil" matches an ingredient of
 * "vegetable oil", and "fresh ginger" matches "fresh basil" - the shared
 * word is real but it is not the food.
 */
const IGNORED = new Set([
  'oil', 'fresh', 'dried', 'ground', 'chopped', 'sliced', 'large', 'small',
  'medium', 'whole', 'raw', 'cooked', 'plain', 'free', 'low', 'fat', 'light',
  'extra', 'virgin', 'powder', 'leaf', 'leave', 'seed', 'sauce', 'paste',
  'stock', 'juice', 'and', 'the', 'for', 'with', 'into', 'or',
]);

function meaningful(value: string): Set<string> {
  return new Set(words(value).filter((word) => !IGNORED.has(word)));
}

/** True when the pantry entry and the ingredient name share a real food word. */
function matches(ingredientName: string, pantryEntry: string): boolean {
  const pantry = meaningful(pantryEntry);
  if (pantry.size === 0) return false;

  for (const word of meaningful(ingredientName)) {
    if (pantry.has(word)) return true;
  }
  return false;
}

/**
 * Split a recipe's ingredients by whether the pantry covers them.
 *
 * An empty pantry returns everything as missing, and the caller is expected
 * to show nothing at all in that case: "you are missing all nine
 * ingredients" is technically true and completely useless.
 */
export function matchPantry(
  ingredients: readonly RecipeIngredient[],
  pantryItems: readonly string[],
): PantryMatch {
  const available: RecipeIngredient[] = [];
  const missing: RecipeIngredient[] = [];

  for (const ingredient of ingredients) {
    const found = pantryItems.some((entry) => matches(ingredient.name, entry));
    (found ? available : missing).push(ingredient);
  }

  return { available, missing };
}

/**
 * One sentence about how close the user is to being able to cook this.
 *
 * Null when there is no pantry to compare against, so a screen can leave the
 * whole thing out rather than show a count of nothing.
 */
export function describePantryMatch(match: PantryMatch): string | null {
  const total = match.available.length + match.missing.length;
  if (total === 0) return null;

  if (match.missing.length === 0) {
    return total === 1
      ? 'You have the one ingredient this needs.'
      : `You have all ${total} ingredients.`;
  }

  return `You have ${match.available.length} of ${total} — missing ${match.missing
    .map((ingredient) => ingredient.name.toLowerCase())
    .join(', ')}.`;
}
