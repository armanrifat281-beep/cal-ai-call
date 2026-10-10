import type {
  ConfidenceLevel,
  DailyTargets,
  FoodEntry,
  FoodEntryItem,
  FoodRecord,
  MealType,
  Nutrients,
  Portion,
} from '@/types/domain';

import {
  OPTIONAL_KEYS,
  checkMacroConsistency,
  scaleNutrients,
  scaleNutrientsByGrams,
  sumNutrients,
  type NutrientSum,
  type OptionalNutrientKey,
} from './nutrients';
import { portionToGrams, type GramConversion } from './units';

/**
 * The nutrition engine.
 *
 * This module is deliberately independent of both the AI provider and the food
 * database provider: it takes already-fetched records and turns them into
 * journal items and totals. That separation is what lets us swap either
 * provider, and what lets all of this be unit-tested with no network.
 */

// ---------------------------------------------------------------------------
// Building a journal item from a verified database record
// ---------------------------------------------------------------------------

export type BuildItemOutcome =
  | { status: 'ok'; item: FoodEntryItem; warnings: ItemWarning[] }
  /**
   * The chosen unit cannot be converted to a weight for this food, so the
   * caller must ask the user for grams or a different unit. We never guess.
   */
  | { status: 'needs_portion'; reason: string; suggestedUnits: Portion['unit'][] };

export type ItemWarning =
  /** An ml portion was converted using the density of water. */
  | { kind: 'assumed_density'; message: string }
  /** Stated calories and the macro breakdown disagree materially. */
  | { kind: 'macro_mismatch'; message: string; relativeDifference: number }
  /** Some optional nutrients are not available from the provider. */
  | { kind: 'missing_nutrients'; message: string; keys: OptionalNutrientKey[] };

export interface BuildItemFromRecordInput {
  id: string;
  record: FoodRecord;
  portion: Portion;
  /** How confident the identification was. Portion maths does not change it. */
  confidence: ConfidenceLevel;
  notes?: string | null;
}

/**
 * Turn a food database record plus a portion into a journal item.
 *
 * Nutrient values come from the record and are scaled by weight, so the item's
 * provenance is `database`: these are looked-up values, not model output.
 */
export function buildItemFromRecord(input: BuildItemFromRecordInput): BuildItemOutcome {
  const { id, record, portion, confidence, notes = null } = input;

  const conversion = portionToGrams(portion, record.portionOptions);
  if (!conversion) {
    return {
      status: 'needs_portion',
      reason: `We don't know how much "${portion.unit}" weighs for ${record.name}.`,
      suggestedUnits: suggestedUnitsFor(record),
    };
  }

  const nutrients = scaleNutrientsByGrams(record.nutrientsPer100g, conversion.grams);
  const warnings = collectWarnings(nutrients, conversion, record.name);

  const item: FoodEntryItem = {
    id,
    name: record.name,
    brand: record.brand,
    portion,
    gramsResolved: conversion.grams,
    nutrients,
    provenance: {
      source: 'database',
      confidence,
      providerLabel: record.providerLabel,
      providerRef: record.providerRef,
    },
    foodRecordId: record.id,
    notes,
  };

  return { status: 'ok', item, warnings };
}

/** Units we can definitely convert for this record, best first. */
export function suggestedUnitsFor(
  record: Pick<FoodRecord, 'portionOptions'>,
): Portion['unit'][] {
  const fromRecord = record.portionOptions
    .filter((option) => option.gramsPerUnit > 0)
    .map((option) => option.unit);
  return [...new Set<Portion['unit']>(['g', 'oz', ...fromRecord])];
}

// ---------------------------------------------------------------------------
// Building a journal item from a model estimate (no database match)
// ---------------------------------------------------------------------------

export interface BuildItemFromEstimateInput {
  id: string;
  name: string;
  portion: Portion;
  /** Nutrients the model gave FOR THIS PORTION, not per 100 g. */
  nutrientsForPortion: Nutrients;
  /** The model's own weight estimate in grams, when it gave one. */
  estimatedGrams?: number | null;
  confidence: ConfidenceLevel;
  providerLabel: string;
  notes?: string | null;
}

/**
 * Turn a model estimate into a journal item.
 *
 * Provenance is `ai_estimate`, which the UI renders differently from a
 * database match. No scaling happens here: the model is asked for values for
 * the portion it believes it saw, and we record exactly that.
 */
export function buildItemFromEstimate(
  input: BuildItemFromEstimateInput,
): { item: FoodEntryItem; warnings: ItemWarning[] } {
  const {
    id,
    name,
    portion,
    nutrientsForPortion,
    estimatedGrams = null,
    confidence,
    providerLabel,
    notes = null,
  } = input;

  const warnings = collectWarnings(nutrientsForPortion, null, name);

  const item: FoodEntryItem = {
    id,
    name,
    brand: null,
    portion,
    gramsResolved:
      estimatedGrams !== null && Number.isFinite(estimatedGrams) && estimatedGrams > 0
        ? estimatedGrams
        : null,
    nutrients: nutrientsForPortion,
    provenance: {
      source: 'ai_estimate',
      confidence,
      providerLabel,
      providerRef: null,
    },
    foodRecordId: null,
    notes,
  };

  return { item, warnings };
}

function collectWarnings(
  nutrients: Nutrients,
  conversion: GramConversion | null,
  foodName: string,
): ItemWarning[] {
  const warnings: ItemWarning[] = [];

  if (conversion?.assumedDensity) {
    warnings.push({
      kind: 'assumed_density',
      message: `Volume was converted to weight assuming 1 ml = 1 g, which is only accurate for water-like liquids.`,
    });
  }

  const consistency = checkMacroConsistency(nutrients);
  if (consistency.isInconsistent) {
    warnings.push({
      kind: 'macro_mismatch',
      message: `The calories for ${foodName} do not match its protein, carbs and fat. Please check the numbers.`,
      relativeDifference: consistency.relativeDifference,
    });
  }

  const missing = OPTIONAL_KEYS.filter((key) => nutrients[key] === null);
  if (missing.length > 0) {
    warnings.push({
      kind: 'missing_nutrients',
      message: 'Some nutrient details are not available for this food.',
      keys: [...missing],
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Re-portioning an existing item
// ---------------------------------------------------------------------------

/**
 * Change an item's portion and rescale its nutrients.
 *
 * Only possible when the original portion resolved to a weight; otherwise the
 * per-gram rate is unknown and the caller must re-fetch or ask the user.
 */
export function reportionItem(
  item: FoodEntryItem,
  nextPortion: Portion,
  portionOptions: FoodRecord['portionOptions'] = [],
): BuildItemOutcome {
  if (item.gramsResolved === null || item.gramsResolved <= 0) {
    return {
      status: 'needs_portion',
      reason: `We don't have a weight for the original portion of ${item.name}, so it can't be rescaled.`,
      suggestedUnits: ['g', 'oz'],
    };
  }

  const conversion = portionToGrams(nextPortion, portionOptions);
  if (!conversion) {
    return {
      status: 'needs_portion',
      reason: `We don't know how much "${nextPortion.unit}" weighs for ${item.name}.`,
      suggestedUnits: ['g', 'oz'],
    };
  }

  // `item.nutrients` covers `item.gramsResolved` grams. Normalize to a
  // per-100 g rate first, then scale that rate to the new weight.
  const per100g = scaleNutrients(item.nutrients, 100 / item.gramsResolved);
  const nutrients = scaleNutrientsByGrams(per100g, conversion.grams);

  return {
    status: 'ok',
    item: { ...item, portion: nextPortion, gramsResolved: conversion.grams, nutrients },
    warnings: collectWarnings(nutrients, conversion, item.name),
  };
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

/** Sum the items of one entry. */
export function computeEntryTotals(entry: Pick<FoodEntry, 'items'>): NutrientSum {
  return sumNutrients(entry.items.map((item) => item.nutrients));
}

export interface DaySummary {
  totals: NutrientSum;
  entryCount: number
  itemCount: number;
  /** Totals split by meal type, for the daily timeline. */
  byMealType: Record<MealType, NutrientSum>;
  /** True when at least one item is a model estimate rather than a lookup. */
  containsEstimates: boolean;
}

/** Summarize a set of entries, e.g. everything logged on one day. */
export function summarizeEntries(entries: readonly FoodEntry[]): DaySummary {
  const allItems = entries.flatMap((entry) => entry.items);

  const byMealType = {
    breakfast: sumNutrients(nutrientsFor(entries, 'breakfast')),
    lunch: sumNutrients(nutrientsFor(entries, 'lunch')),
    dinner: sumNutrients(nutrientsFor(entries, 'dinner')),
    snack: sumNutrients(nutrientsFor(entries, 'snack')),
  } satisfies Record<MealType, NutrientSum>;

  return {
    totals: sumNutrients(allItems.map((item) => item.nutrients)),
    entryCount: entries.length,
    itemCount: allItems.length,
    byMealType,
    containsEstimates: allItems.some(
      (item) => item.provenance.source === 'ai_estimate',
    ),
  };
}

function nutrientsFor(entries: readonly FoodEntry[], mealType: MealType): Nutrients[] {
  return entries
    .filter((entry) => entry.mealType === mealType)
    .flatMap((entry) => entry.items.map((item) => item.nutrients));
}

// ---------------------------------------------------------------------------
// Goal progress
// ---------------------------------------------------------------------------

export interface TargetProgress {
  /** 0..1 of the target consumed. `null` when no target is set. */
  ratio: number | null;
  consumed: number;
  target: number | null;
  remaining: number | null;
  /** True when consumption exceeds the target. */
  isOver: boolean;
}

/** Progress toward one daily target. */
export function computeTargetProgress(
  consumed: number,
  target: number | null,
): TargetProgress {
  if (target === null || !Number.isFinite(target) || target <= 0) {
    return { ratio: null, consumed, target: null, remaining: null, isOver: false };
  }
  return {
    ratio: consumed / target,
    consumed,
    target,
    remaining: Math.max(0, target - consumed),
    isOver: consumed > target,
  };
}

export interface DailyProgress {
  calories: TargetProgress;
  protein: TargetProgress;
  carbs: TargetProgress;
  fat: TargetProgress;
  /** True when the user has not set any targets. */
  hasAnyTarget: boolean;
}

export function computeDailyProgress(
  totals: Nutrients,
  targets: DailyTargets,
): DailyProgress {
  return {
    calories: computeTargetProgress(totals.caloriesKcal, targets.caloriesKcal),
    protein: computeTargetProgress(totals.proteinG, targets.proteinG),
    carbs: computeTargetProgress(totals.carbsG, targets.carbsG),
    fat: computeTargetProgress(totals.fatG, targets.fatG),
    hasAnyTarget:
      targets.caloriesKcal !== null ||
      targets.proteinG !== null ||
      targets.carbsG !== null ||
      targets.fatG !== null,
  };
}
