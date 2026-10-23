import type { FoodEntry, Nutrients } from '@/types/domain';

import { computeEntryTotals } from './engine';

/**
 * How good a meal is, as one number.
 *
 * This is the app's own heuristic and it is deliberately simple and
 * written down, because the alternative - a number from a model with no
 * stated basis - is a judgement about someone's food that nobody can argue
 * with. Everything here is arithmetic over nutrients the app already holds,
 * so any score can be taken apart and checked.
 *
 * It scores DENSITY, not amount: grams of each nutrient per 100 kcal. A
 * large portion of a good food and a small one of the same food score the
 * same, which is correct - the portion is the calorie figure's job, and a
 * score that fell as you ate more would just be the calorie count again.
 *
 * It is not a verdict on a diet, a medical opinion, or a reason to skip a
 * meal. It answers one narrow question: for the energy it carries, how much
 * of what the body needs does this food bring with it?
 */

/** The ceiling of each contribution, so the weights are visible in one place. */
const WEIGHTS = {
  protein: 2,
  fibre: 2,
  sugar: -2,
  saturatedFat: -1.5,
  sodium: -1.5,
} as const;

/**
 * Where each nutrient's contribution reaches its full value, per 100 kcal.
 *
 * Chosen to put ordinary whole foods near the top rather than only at it:
 * chicken breast runs about 19 g of protein per 100 kcal, lentils about
 * 3.5 g of fibre, and both should read as good rather than as merely
 * acceptable.
 */
const FULL_AT = {
  /** g of protein per 100 kcal. */
  protein: 9,
  /** g of fibre per 100 kcal. */
  fibre: 3,
  /** g of sugar per 100 kcal. */
  sugar: 12,
  /** g of saturated fat per 100 kcal. */
  saturatedFat: 4.5,
  /** mg of sodium per 100 kcal, above the free allowance below. */
  sodium: 600,
} as const;

/**
 * Sodium under this per 100 kcal costs nothing.
 *
 * Salt is in everything and a scale that starts at zero would mark down
 * every cooked meal on earth. This is roughly the level at which a dish
 * stops tasting seasoned and starts tasting salty.
 */
const SODIUM_FREE_ALLOWANCE = 120;

/** Below this there is not enough energy for a density to mean anything. */
const MIN_KCAL = 20;

export interface FoodScore {
  /** 0..10, one decimal. Null when there is too little to judge. */
  value: number | null;
  /** 0..100, for the badge on a food's own screen. */
  outOfHundred: number | null;
  /**
   * How much of the score rests on figures the app actually has, 0..1.
   *
   * A food with no fibre, sugar, saturated fat or sodium recorded can still
   * be scored on protein alone, but the result deserves a hedge rather than
   * a badge - so the screens show this rather than hiding it.
   */
  known: number;
  /** The word the number is shown with, e.g. "Good". */
  band: ScoreBand;
}

export type ScoreBand = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export function bandFor(value: number | null): ScoreBand {
  if (value === null) return 'unknown';
  if (value >= 8) return 'excellent';
  if (value >= 6.5) return 'good';
  if (value >= 4.5) return 'fair';
  return 'poor';
}

export const SCORE_BAND_LABELS: Record<ScoreBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Low',
  unknown: 'Not enough detail',
};

/** A contribution that rises from 0 to 1 as `value` goes from 0 to `full`. */
function ramp(value: number, full: number): number {
  if (full <= 0) return 0;
  return Math.max(0, Math.min(1, value / full));
}

/**
 * Score one set of nutrients.
 *
 * Starts at the middle and moves from there, so a food about which almost
 * nothing is known lands at "fair" rather than at either extreme.
 */
export function scoreNutrients(nutrients: Nutrients): FoodScore {
  const kcal = nutrients.caloriesKcal;
  if (!Number.isFinite(kcal) || kcal < MIN_KCAL) {
    return { value: null, outOfHundred: null, known: 0, band: 'unknown' };
  }

  const per100 = 100 / kcal;
  let score = 5;
  // Four of the five inputs are optional in the data model; this counts how
  // many of them were actually present.
  let knownCount = 1;

  score += WEIGHTS.protein * ramp(nutrients.proteinG * per100, FULL_AT.protein);

  if (nutrients.fiberG !== null) {
    knownCount += 1;
    score += WEIGHTS.fibre * ramp(nutrients.fiberG * per100, FULL_AT.fibre);
  }

  if (nutrients.sugarG !== null) {
    knownCount += 1;
    score += WEIGHTS.sugar * ramp(nutrients.sugarG * per100, FULL_AT.sugar);
  }

  if (nutrients.saturatedFatG !== null) {
    knownCount += 1;
    score +=
      WEIGHTS.saturatedFat *
      ramp(nutrients.saturatedFatG * per100, FULL_AT.saturatedFat);
  }

  if (nutrients.sodiumMg !== null) {
    knownCount += 1;
    const over = Math.max(0, nutrients.sodiumMg * per100 - SODIUM_FREE_ALLOWANCE);
    score += WEIGHTS.sodium * ramp(over, FULL_AT.sodium);
  }

  const clamped = Math.max(0, Math.min(10, score));
  const value = Math.round(clamped * 10) / 10;

  return {
    value,
    outOfHundred: Math.round(clamped * 10),
    known: knownCount / 5,
    band: bandFor(value),
  };
}

/** Score a whole logged meal, from the sum of its items. */
export function scoreEntry(entry: Pick<FoodEntry, 'items'>): FoodScore {
  return scoreNutrients(computeEntryTotals(entry).nutrients);
}

/**
 * The day's score: every meal, weighted by the energy it carried.
 *
 * Weighted rather than averaged, so a 40 kcal apple cannot pull a day of
 * 2,000 kcal up by the same amount as dinner. A day with nothing logged has
 * no score at all - zero would read as a bad day rather than an empty one.
 */
export function scoreDay(entries: readonly Pick<FoodEntry, 'items'>[]): FoodScore {
  let weighted = 0;
  let weight = 0;
  let known = 0;

  for (const entry of entries) {
    const totals = computeEntryTotals(entry).nutrients;
    const score = scoreNutrients(totals);
    if (score.value === null) continue;

    weighted += score.value * totals.caloriesKcal;
    weight += totals.caloriesKcal;
    known += score.known * totals.caloriesKcal;
  }

  if (weight <= 0) {
    return { value: null, outOfHundred: null, known: 0, band: 'unknown' };
  }

  const value = Math.round((weighted / weight) * 10) / 10;
  return {
    value,
    outOfHundred: Math.round(value * 10),
    known: known / weight,
    band: bandFor(value),
  };
}

// ---------------------------------------------------------------------------
// What the score is made of
// ---------------------------------------------------------------------------

export interface Characteristic {
  /** A sentence, e.g. "High in protein for its calories". */
  text: string;
  /** True when this is why the score is high rather than why it is low. */
  good: boolean;
}

/**
 * The score, said in words.
 *
 * A number alone tells someone their lunch scored 3.2 and nothing else,
 * which is a judgement without a reason. These are the same thresholds the
 * score is built from, written out - so the list and the number can never
 * disagree, and anyone who thinks the score is wrong can see exactly which
 * line they disagree with.
 *
 * Good news first and at most six lines: past that it is a nutrition label,
 * which the app already has a screen for.
 */
export function describeNutrients(nutrients: Nutrients): Characteristic[] {
  const kcal = nutrients.caloriesKcal;
  if (!Number.isFinite(kcal) || kcal < MIN_KCAL) return [];

  const per100 = 100 / kcal;
  const good: Characteristic[] = [];
  const bad: Characteristic[] = [];

  const protein = nutrients.proteinG * per100;
  if (protein >= 7) good.push({ text: 'High in protein for its calories', good: true });
  else if (protein < 2) bad.push({ text: 'Little protein for its calories', good: false });

  if (nutrients.fiberG !== null) {
    const fibre = nutrients.fiberG * per100;
    if (fibre >= 2.5) good.push({ text: 'A good source of fibre', good: true });
    else if (fibre < 0.5) bad.push({ text: 'Low in fibre', good: false });
  }

  if (nutrients.sugarG !== null) {
    const sugar = nutrients.sugarG * per100;
    if (sugar >= 9) bad.push({ text: 'High in sugar', good: false });
    else if (sugar <= 2) good.push({ text: 'Low in sugar', good: true });
  }

  if (nutrients.saturatedFatG !== null) {
    const sat = nutrients.saturatedFatG * per100;
    if (sat >= 3.5) bad.push({ text: 'High in saturated fat', good: false });
    else if (sat <= 1) good.push({ text: 'Low in saturated fat', good: true });
  }

  if (nutrients.sodiumMg !== null) {
    const sodium = nutrients.sodiumMg * per100;
    if (sodium >= 450) bad.push({ text: 'Salty for its size', good: false });
    else if (sodium <= 120) good.push({ text: 'Lightly salted', good: true });
  }

  return [...good, ...bad].slice(0, 6);
}

export function describeEntry(entry: Pick<FoodEntry, 'items'>): Characteristic[] {
  return describeNutrients(computeEntryTotals(entry).nutrients);
}
