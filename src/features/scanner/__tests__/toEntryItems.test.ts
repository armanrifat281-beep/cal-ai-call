import { analysisToEntryItems } from '../toEntryItems';
import type { FoodCandidate, MealAnalysis, RecognizedFood } from '../types';
import type { Nutrients } from '@/types/domain';

const PER_100G: Nutrients = {
  caloriesKcal: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
  fiberG: 0,
  sugarG: 0,
  saturatedFatG: 1,
  sodiumMg: 74,
};

function candidate(overrides: Partial<FoodCandidate> = {}): FoodCandidate {
  return {
    foodRecordId: 'usda:171477',
    name: 'Chicken breast, grilled',
    brand: null,
    providerLabel: 'USDA FoodData Central',
    nutrientsPer100g: PER_100G,
    matchScore: 0.95,
    ...overrides,
  };
}

function food(overrides: Partial<RecognizedFood> = {}): RecognizedFood {
  return {
    name: 'Grilled chicken',
    possibleIngredients: [],
    confidence: 'medium',
    estimatedPortion: null,
    estimatedGrams: null,
    estimatedNutrients: null,
    candidates: [],
    ...overrides,
  };
}

function analysis(foods: RecognizedFood[]): MealAnalysis {
  return {
    foods,
    suggestedMealType: 'lunch',
    suggestedTitle: 'Chicken rice bowl',
    needsUserConfirmation: false,
    caveats: [],
    providerLabel: 'Claude',
    photoPath: null,
  };
}

describe('analysisToEntryItems', () => {
  describe('a matched record with an estimated weight', () => {
    // A looked-up value is a measurement; the model's figure for the same
    // food is a guess at one. The record has to win.
    it('scales the record rather than trusting the model', () => {
      const [item] = analysisToEntryItems(
        analysis([
          food({
            candidates: [candidate()],
            estimatedGrams: 150,
            estimatedPortion: { quantity: 150, unit: 'g' },
            // Deliberately different, and deliberately ignored.
            estimatedNutrients: { ...PER_100G, caloriesKcal: 900 },
          }),
        ]),
      );

      expect(item?.provenance.source).toBe('database');
      expect(item?.nutrients.caloriesKcal).toBeCloseTo(247.5);
      expect(item?.gramsResolved).toBe(150);
      expect(item?.foodRecordId).toBe('usda:171477');
      expect(item?.provenance.providerLabel).toBe('USDA FoodData Central');
    });

    it('takes the record name, not the model guess', () => {
      const [item] = analysisToEntryItems(
        analysis([
          food({ name: 'Some chicken thing', candidates: [candidate()], estimatedGrams: 100 }),
        ]),
      );

      expect(item?.name).toBe('Chicken breast, grilled');
    });
  });

  describe("the model's own figures", () => {
    it('is used when no record matched, and labelled an estimate', () => {
      const [item] = analysisToEntryItems(
        analysis([
          food({
            name: 'Mixed vegetables',
            estimatedNutrients: { ...PER_100G, caloriesKcal: 72 },
            estimatedPortion: { quantity: 1, unit: 'cup' },
            estimatedGrams: 90,
          }),
        ]),
      );

      expect(item?.provenance.source).toBe('ai_estimate');
      expect(item?.provenance.providerLabel).toBe('Claude');
      expect(item?.nutrients.caloriesKcal).toBe(72);
      expect(item?.name).toBe('Mixed vegetables');
    });

    // A portion the model judged is worth more than a weight nobody judged.
    it('beats a record that has no weight to scale by', () => {
      const [item] = analysisToEntryItems(
        analysis([
          food({
            candidates: [candidate()],
            estimatedGrams: null,
            estimatedNutrients: { ...PER_100G, caloriesKcal: 210 },
          }),
        ]),
      );

      expect(item?.provenance.source).toBe('ai_estimate');
      expect(item?.nutrients.caloriesKcal).toBe(210);
      // The record is still the food the user meant.
      expect(item?.foodRecordId).toBe('usda:171477');
    });

    it('records one serving when size could not be judged at all', () => {
      const [item] = analysisToEntryItems(
        analysis([food({ estimatedNutrients: PER_100G })]),
      );

      expect(item?.portion).toEqual({ quantity: 1, unit: 'serving' });
      expect(item?.gramsResolved).toBeNull();
    });
  });

  describe('a record with no weight and no estimate', () => {
    // 100 g said out loud is checkable; a silent assumption is not.
    it('states the portion as 100 g rather than assuming it quietly', () => {
      const [item] = analysisToEntryItems(
        analysis([food({ candidates: [candidate()], confidence: 'high' })]),
      );

      expect(item?.portion).toEqual({ quantity: 100, unit: 'g' });
      expect(item?.gramsResolved).toBe(100);
      expect(item?.nutrients.caloriesKcal).toBeCloseTo(165);
    });

    it('drops the confidence to low, because the quantity is unknown', () => {
      const [item] = analysisToEntryItems(
        analysis([food({ candidates: [candidate()], confidence: 'high' })]),
      );

      expect(item?.provenance.confidence).toBe('low');
    });
  });

  it('keeps the order the analyser gave, which is the order shown', () => {
    const items = analysisToEntryItems(
      analysis([
        food({ name: 'First', estimatedNutrients: PER_100G }),
        food({ name: 'Second', estimatedNutrients: PER_100G }),
      ]),
    );

    expect(items.map((item) => item.name)).toEqual(['First', 'Second']);
    // Ids have to differ or the editor's list collapses them.
    expect(new Set(items.map((item) => item.id)).size).toBe(2);
  });

  it('returns nothing for an analysis that found nothing', () => {
    expect(analysisToEntryItems(analysis([]))).toEqual([]);
  });
});
