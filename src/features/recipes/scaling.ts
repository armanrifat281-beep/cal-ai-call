import type { Recipe, RecipeIngredient, RecipeNutrition } from '@/types/recipe';

import { formatIngredientAmount, isUnitWithoutQuantity } from './units';

/**
 * Serving adjustment.
 *
 * The rules here are what make "serves 4" into "serves 6" trustworthy:
 *
 *  - Quantities scale by `target / base`, computed from the ORIGINAL recipe
 *    every time. Scaling an already-scaled recipe would compound rounding
 *    error, so a scaled view is always derived, never stored back.
 *  - Nutrition is PER SERVING and therefore does not scale at all. Doubling
 *    the servings doubles the food, not the calories in each plate. Getting
 *    this backwards is the single easiest way to mislead someone.
 *  - An ingredient marked `scalesWithServings: false` is left alone. Oil for
 *    frying depends on the pan, not the number of eaters.
 */

/** The largest and smallest serving counts the UI offers. */
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 24;

/**
 * Brings a serving count into the offered range.
 *
 * Anything non-finite falls back to the MINIMUM, not the maximum: an
 * unreadable value is a bug, and quietly producing a 24-serving shopping list
 * from one is worse than producing a 1-serving one.
 */
export function clampServings(servings: number): number {
  if (!Number.isFinite(servings)) return MIN_SERVINGS;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(servings)));
}

/**
 * The factor to multiply quantities by.
 *
 * Guards a zero or negative base, which would otherwise produce Infinity and
 * render as a nonsense amount.
 */
export function scaleFactor(baseServings: number, targetServings: number): number {
  if (!Number.isFinite(baseServings) || baseServings <= 0) return 1;
  if (!Number.isFinite(targetServings) || targetServings <= 0) return 1;
  return targetServings / baseServings;
}

/** An ingredient with its quantity adjusted for the chosen serving count. */
export interface ScaledIngredient extends RecipeIngredient {
  /** Quantity at the target serving count, unrounded. */
  scaledQuantity: number | null;
  /** Ready to display, e.g. "1 1/3 cups". */
  displayAmount: string;
  /** True when this ingredient was deliberately not scaled. */
  wasHeldFixed: boolean;
}

export function scaleIngredient(
  ingredient: RecipeIngredient,
  factor: number,
): ScaledIngredient {
  const holdsFixed =
    !ingredient.scalesWithServings ||
    ingredient.quantity === null ||
    (ingredient.unit !== null && isUnitWithoutQuantity(ingredient.unit));

  const scaledQuantity = holdsFixed
    ? ingredient.quantity
    : (ingredient.quantity ?? 0) * factor;

  return {
    ...ingredient,
    scaledQuantity,
    displayAmount: formatIngredientAmount(scaledQuantity, ingredient.unit),
    wasHeldFixed: holdsFixed && ingredient.quantity !== null,
  };
}

export interface ScaledRecipe {
  recipe: Recipe;
  /** The serving count this view is for. */
  servings: number;
  factor: number;
  ingredients: ScaledIngredient[];
  /**
   * Unchanged from the recipe. Repeated here so a screen cannot accidentally
   * scale it: these are per-serving figures.
   */
  nutritionPerServing: RecipeNutrition | null;
  /** True when at least one ingredient was held fixed, so the UI can say so. */
  hasHeldIngredients: boolean;
}

/**
 * Produces a view of a recipe at a different serving count.
 *
 * Always derived from the stored recipe, never from a previous scaled view.
 */
export function scaleRecipe(recipe: Recipe, targetServings: number): ScaledRecipe {
  const servings = clampServings(targetServings);
  const factor = scaleFactor(recipe.servings, servings);
  const ingredients = recipe.ingredients.map((ingredient) =>
    scaleIngredient(ingredient, factor),
  );

  return {
    recipe,
    servings,
    factor,
    ingredients,
    nutritionPerServing: recipe.nutritionPerServing,
    hasHeldIngredients: ingredients.some((ingredient) => ingredient.wasHeldFixed),
  };
}

/** Total nutrition for a whole batch at the chosen serving count. */
export function batchNutrition(
  nutrition: RecipeNutrition | null,
  servings: number,
): RecipeNutrition | null {
  if (!nutrition) return null;
  const count = clampServings(servings);
  return {
    caloriesKcal: nutrition.caloriesKcal * count,
    proteinG: nutrition.proteinG * count,
    carbsG: nutrition.carbsG * count,
    fatG: nutrition.fatG * count,
    source: nutrition.source,
    providerLabel: nutrition.providerLabel,
  };
}

// ---------------------------------------------------------------------------
// Internal consistency
// ---------------------------------------------------------------------------

export type ConsistencyIssue =
  /** An ingredient has a unit that needs a quantity, but has none. */
  | { kind: 'missing_quantity'; ingredientName: string }
  /** A quantity is zero or negative. */
  | { kind: 'non_positive_quantity'; ingredientName: string }
  /** A step refers to an ingredient id that is not in the list. */
  | { kind: 'unknown_ingredient_reference'; stepNumber: number; ingredientId: string }
  /** Steps are not numbered 1..n. */
  | { kind: 'step_numbering'; detail: string }
  /** An ingredient appears twice, which makes the checklist ambiguous. */
  | { kind: 'duplicate_ingredient'; ingredientName: string }
  /** The stated macros do not match the stated calories. */
  | { kind: 'macro_mismatch'; impliedKcal: number; statedKcal: number }
  /** Scaling and unscaling does not return the original quantity. */
  | { kind: 'scaling_not_reversible'; ingredientName: string };

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  /** True when nothing would mislead the user. */
  isConsistent: boolean;
}

/** Energy per gram, for checking a recipe's own numbers against itself. */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * Checks a recipe against itself.
 *
 * This runs on every generated recipe before it is shown. It does not judge
 * whether the recipe is good; it catches the ways a generated recipe can be
 * internally contradictory, which is what would mislead someone following it.
 *
 * @param macroTolerance Allowed relative gap between stated and implied
 *                       calories. Fibre, alcohol and rounding make a small
 *                       gap normal.
 */
export function checkRecipeConsistency(
  recipe: Recipe,
  macroTolerance = 0.3,
): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];
  const seenNames = new Set<string>();
  const ingredientIds = new Set(recipe.ingredients.map((item) => item.id));

  for (const ingredient of recipe.ingredients) {
    const name = ingredient.name.trim().toLowerCase();
    if (name.length > 0) {
      if (seenNames.has(name)) {
        issues.push({ kind: 'duplicate_ingredient', ingredientName: ingredient.name });
      }
      seenNames.add(name);
    }

    const unitNeedsQuantity =
      ingredient.unit !== null && !isUnitWithoutQuantity(ingredient.unit);

    if (unitNeedsQuantity && ingredient.quantity === null) {
      issues.push({ kind: 'missing_quantity', ingredientName: ingredient.name });
    }

    if (ingredient.quantity !== null && ingredient.quantity <= 0) {
      issues.push({
        kind: 'non_positive_quantity',
        ingredientName: ingredient.name,
      });
    }

    // Scaling must be reversible: double it, halve it, get back where you
    // started. A unit whose rounding loses information would fail this.
    if (ingredient.quantity !== null && ingredient.scalesWithServings) {
      const doubled = scaleIngredient(ingredient, 2).scaledQuantity ?? 0;
      const restored = (doubled * 1) / 2;
      if (Math.abs(restored - ingredient.quantity) > 1e-6) {
        issues.push({
          kind: 'scaling_not_reversible',
          ingredientName: ingredient.name,
        });
      }
    }
  }

  recipe.steps.forEach((step, index) => {
    if (step.number !== index + 1) {
      issues.push({
        kind: 'step_numbering',
        detail: `step at position ${index + 1} is numbered ${step.number}`,
      });
    }
    for (const id of step.ingredientIds) {
      if (!ingredientIds.has(id)) {
        issues.push({
          kind: 'unknown_ingredient_reference',
          stepNumber: step.number,
          ingredientId: id,
        });
      }
    }
  });

  const nutrition = recipe.nutritionPerServing;
  if (nutrition) {
    const impliedKcal =
      nutrition.proteinG * KCAL_PER_GRAM.protein +
      nutrition.carbsG * KCAL_PER_GRAM.carbs +
      nutrition.fatG * KCAL_PER_GRAM.fat;
    const largest = Math.max(impliedKcal, nutrition.caloriesKcal);

    if (largest >= 1) {
      const relative = Math.abs(impliedKcal - nutrition.caloriesKcal) / largest;
      if (relative > macroTolerance) {
        issues.push({
          kind: 'macro_mismatch',
          impliedKcal,
          statedKcal: nutrition.caloriesKcal,
        });
      }
    }
  }

  return { issues, isConsistent: issues.length === 0 };
}

/** One sentence per issue, for showing the user what looked wrong. */
export function describeConsistencyIssue(issue: ConsistencyIssue): string {
  switch (issue.kind) {
    case 'missing_quantity':
      return `"${issue.ingredientName}" has a unit but no amount.`;
    case 'non_positive_quantity':
      return `"${issue.ingredientName}" has an amount of zero or less.`;
    case 'unknown_ingredient_reference':
      return `Step ${issue.stepNumber} refers to an ingredient that is not in the list.`;
    case 'step_numbering':
      return `The steps are numbered inconsistently (${issue.detail}).`;
    case 'duplicate_ingredient':
      return `"${issue.ingredientName}" is listed more than once.`;
    case 'macro_mismatch':
      return `The protein, carbs and fat come to about ${Math.round(
        issue.impliedKcal,
      )} kcal per serving, but the recipe says ${Math.round(issue.statedKcal)}.`;
    case 'scaling_not_reversible':
      return `The amount of "${issue.ingredientName}" cannot be scaled reliably.`;
    default:
      return 'Something about this recipe is inconsistent.';
  }
}
