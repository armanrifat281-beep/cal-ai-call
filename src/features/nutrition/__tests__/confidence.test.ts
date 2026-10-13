import type { FoodEntry, FoodEntryItem, NutrientSource } from '@/types/domain';

import { describeConfidence, summarizeConfidence } from '../confidence';

function item(kcal: number, source: NutrientSource): FoodEntryItem {
  return {
    id: `i${Math.random()}`,
    name: 'Food',
    brand: null,
    portion: { quantity: 100, unit: 'g' },
    gramsResolved: 100,
    nutrients: {
      caloriesKcal: kcal,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: null,
      sugarG: null,
      saturatedFatG: null,
      sodiumMg: null,
    },
    provenance: { source, confidence: 'high', providerLabel: null, providerRef: null },
    foodRecordId: null,
    notes: null,
  };
}

function day(items: FoodEntryItem[]): FoodEntry[] {
  return [
    {
      id: 'e1',
      userId: 'u1',
      consumedAt: new Date().toISOString(),
      mealType: 'lunch',
      title: 'Lunch',
      items,
      photoPath: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

describe('summarizeConfidence', () => {
  it('splits the day by where each figure came from', () => {
    const result = summarizeConfidence(
      day([item(300, 'database'), item(200, 'ai_estimate'), item(100, 'user_entered')]),
    );

    expect(result.measuredKcal).toBe(300);
    expect(result.estimatedKcal).toBe(200);
    expect(result.ownKcal).toBe(100);
  });

  /*
    Weighted by calories, not by item count. Five looked-up foods and one
    estimated sauce is not "83% measured" when the sauce is a third of the
    energy - counting items would flatter the figure exactly where it
    matters most.
  */
  it('weights the share by calories, not by how many foods there are', () => {
    const result = summarizeConfidence(
      day([
        item(50, 'database'),
        item(50, 'database'),
        item(50, 'database'),
        item(50, 'database'),
        item(50, 'database'),
        item(250, 'ai_estimate'),
      ]),
    );

    // Five of six items are measured, but only half the calories are.
    expect(result.measuredShare).toBeCloseTo(0.5);
  });

  it('counts a value the user typed as theirs, not as measured', () => {
    const result = summarizeConfidence(day([item(500, 'user_entered')]));

    // Their own claim is not a laboratory measurement - but it is not this
    // app guessing either, which is why it has its own bucket.
    expect(result.measuredShare).toBe(0);
    expect(result.ownKcal).toBe(500);
  });

  describe('a food with no calorie figure', () => {
    // Counting it as a measured zero would make the day look better the
    // less the app knew about it.
    it('is kept out of the share and reported separately', () => {
      const result = summarizeConfidence(
        day([item(400, 'database'), item(0, 'ai_estimate')]),
      );

      expect(result.measuredShare).toBe(1);
      expect(result.unquantifiedCount).toBe(1);
      expect(result.itemCount).toBe(2);
    });

    it('is named in the sentence, so it cannot be missed', () => {
      const sentence = describeConfidence(
        summarizeConfidence(day([item(400, 'database'), item(0, 'ai_estimate')])),
      );

      expect(sentence).toContain('1 food could not be quantified');
    });
  });

  describe('an empty day', () => {
    // A share of nothing is not 0%, it is not a share.
    it('has no share at all rather than zero', () => {
      expect(summarizeConfidence([]).measuredShare).toBeNull();
    });

    it('is described as nothing rather than as a sentence', () => {
      expect(describeConfidence(summarizeConfidence([]))).toBeNull();
    });
  });
});

describe('describeConfidence', () => {
  it('leads with the measured share, which is the point', () => {
    const sentence = describeConfidence(
      summarizeConfidence(day([item(750, 'database'), item(250, 'ai_estimate')])),
    );

    expect(sentence).toContain("75% of today's calories are measured");
    expect(sentence).toContain('250 kcal are estimated');
  });

  // The point is to say what to go and check, never to score the user: a day
  // of home cooking honestly logged by hand is not a worse day.
  it('never praises or grades', () => {
    const sentence =
      describeConfidence(summarizeConfidence(day([item(900, 'database')]))) ?? '';

    expect(sentence).not.toMatch(/good|great|well done|excellent|poor|bad/i);
  });
});
