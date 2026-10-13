import { scaleNutrientsByGrams } from '@/features/nutrition';
import { EMPTY_NUTRIENTS, type FoodEntryItem, type Portion } from '@/types/domain';

import type { MealAnalysis, RecognizedFood } from './types';

/**
 * Turning an analysis into journal items.
 *
 * The analysis and the journal deliberately speak different languages. An
 * analysis is a claim with its workings attached - a guess at a food, maybe
 * some database records that might be it, maybe a portion it could not
 * judge. A journal item is a settled number with a note saying where that
 * number came from. This is the only place that crossing happens.
 *
 * Three cases, in this order of preference:
 *
 *   1. A matched record AND an estimated weight. Real per-100 g values
 *      scaled to what is on the plate: the strongest thing available.
 *   2. The model's own nutrients. They are for the portion it judged, so
 *      they are internally consistent even though they are a guess.
 *   3. A matched record but no weight. The record's numbers are good and
 *      the quantity is unknown, so the portion is set to 100 g *explicitly*
 *      and the confidence dropped to low - the figure shown is then "100 g
 *      of this food", which is checkable, rather than a silent assumption.
 *
 * Case 1 beats case 2 because a looked-up value is a measurement and the
 * model's figure for the same food is a guess at a measurement. Case 2 beats
 * case 3 because a portion the model actually judged is worth more than a
 * weight nobody judged at all.
 */

/** Stated, not assumed: see case 3 above. */
const UNKNOWN_WEIGHT_PORTION: Portion = { quantity: 100, unit: 'g' };
const UNKNOWN_WEIGHT_GRAMS = 100;

/** Used when the analysis could not judge size. */
const ONE_SERVING: Portion = { quantity: 1, unit: 'serving' };

function idFor(index: number): string {
  // Stable within one analysis, which is all the editor needs before save.
  return `analysis-${index}`;
}

function toItem(
  food: RecognizedFood,
  index: number,
  providerLabel: string,
): FoodEntryItem {
  // The server sorts candidates best-first, so this is a presence check
  // rather than a search - written out so the assumption is visible.
  const candidate = food.candidates[0] ?? null;
  const grams = food.estimatedGrams;

  if (candidate !== null && grams !== null) {
    return {
      id: idFor(index),
      name: candidate.name,
      brand: candidate.brand,
      portion: food.estimatedPortion ?? ONE_SERVING,
      gramsResolved: grams,
      nutrients: scaleNutrientsByGrams(candidate.nutrientsPer100g, grams),
      provenance: {
        source: 'database',
        // The record's numbers are not in doubt; the weight they were scaled
        // by is the model's estimate, so this is not claimed as high.
        confidence: food.confidence,
        providerLabel: candidate.providerLabel,
        providerRef: candidate.foodRecordId,
      },
      foodRecordId: candidate.foodRecordId,
      notes: null,
    };
  }

  if (food.estimatedNutrients !== null) {
    return {
      id: idFor(index),
      name: food.name,
      brand: null,
      portion: food.estimatedPortion ?? ONE_SERVING,
      gramsResolved: grams,
      nutrients: food.estimatedNutrients,
      provenance: {
        source: 'ai_estimate',
        confidence: food.confidence,
        providerLabel,
        providerRef: null,
      },
      // A candidate whose numbers could not be used is still the food the
      // user meant, so its record id is kept.
      foodRecordId: candidate?.foodRecordId ?? null,
      notes: null,
    };
  }

  if (candidate !== null) {
    return {
      id: idFor(index),
      name: candidate.name,
      brand: candidate.brand,
      portion: UNKNOWN_WEIGHT_PORTION,
      gramsResolved: UNKNOWN_WEIGHT_GRAMS,
      nutrients: scaleNutrientsByGrams(
        candidate.nutrientsPer100g,
        UNKNOWN_WEIGHT_GRAMS,
      ),
      provenance: {
        source: 'database',
        // Low whatever the model said about the food: nobody judged how much
        // of it there was.
        confidence: 'low',
        providerLabel: candidate.providerLabel,
        providerRef: candidate.foodRecordId,
      },
      foodRecordId: candidate.foodRecordId,
      notes: null,
    };
  }

  /*
    Unreachable: `parseMealAnalysis` drops a food with neither a candidate
    nor estimated nutrients, because such a food gives the user nothing to
    review. It is written out rather than asserted so a future change to the
    parser cannot turn this into a crash - and the zeros it would produce
    are visible here, where the reason they must not happen is explained.
  */
  return {
    id: idFor(index),
    name: food.name,
    brand: null,
    portion: ONE_SERVING,
    gramsResolved: null,
    nutrients: { ...EMPTY_NUTRIENTS },
    provenance: {
      source: 'ai_estimate',
      confidence: 'low',
      providerLabel,
      providerRef: null,
    },
    foodRecordId: null,
    notes: null,
  };
}

export function analysisToEntryItems(analysis: MealAnalysis): FoodEntryItem[] {
  return analysis.foods.map((food, index) =>
    toItem(food, index, analysis.providerLabel),
  );
}
