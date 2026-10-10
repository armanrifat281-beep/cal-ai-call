import {
  RECIPE_UNITS,
  formatIngredientAmount,
  formatUnit,
  isRecipeUnit,
  isUnitWithoutQuantity,
  roundCount,
  roundMetric,
  roundQuantityForUnit,
  toCookingFraction,
} from '../units';

describe('isRecipeUnit', () => {
  it('accepts every declared unit', () => {
    for (const unit of RECIPE_UNITS) {
      expect(isRecipeUnit(unit)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    for (const value of ['cups', 'gram', 'HANDFUL', '', null, 7, {}]) {
      expect(isRecipeUnit(value)).toBe(false);
    }
  });
});

describe('isUnitWithoutQuantity', () => {
  it('is true only for to_taste', () => {
    expect(isUnitWithoutQuantity('to_taste')).toBe(true);
    expect(isUnitWithoutQuantity('g')).toBe(false);
    expect(isUnitWithoutQuantity('pinch')).toBe(false);
    expect(isUnitWithoutQuantity(null)).toBe(false);
  });
});

describe('toCookingFraction', () => {
  it('snaps a scaled value to a fraction a cook can measure', () => {
    expect(toCookingFraction(1.3333)).toEqual({ whole: 1, fraction: '1/3' });
    expect(toCookingFraction(0.5)).toEqual({ whole: 0, fraction: '1/2' });
    expect(toCookingFraction(2.6667)).toEqual({ whole: 2, fraction: '2/3' });
    expect(toCookingFraction(0.75)).toEqual({ whole: 0, fraction: '3/4' });
    expect(toCookingFraction(1.25)).toEqual({ whole: 1, fraction: '1/4' });
  });

  it('drops a fraction that is within rounding noise of a whole number', () => {
    expect(toCookingFraction(2)).toEqual({ whole: 2, fraction: null });
    expect(toCookingFraction(2.01)).toEqual({ whole: 2, fraction: null });
    expect(toCookingFraction(1.99)).toEqual({ whole: 2, fraction: null });
  });

  it('picks the nearest available fraction, not the first one that fits', () => {
    // 0.6 is nearer 2/3 (0.667) than 1/2 (0.5).
    expect(toCookingFraction(0.6).fraction).toBe('2/3');
    // 0.55 is nearer 1/2.
    expect(toCookingFraction(0.55).fraction).toBe('1/2');
  });

  it('handles zero', () => {
    expect(toCookingFraction(0)).toEqual({ whole: 0, fraction: null });
  });
});

describe('roundMetric', () => {
  it('keeps precision where it matters and drops it where it does not', () => {
    expect(roundMetric(0.25)).toBe(0.25);
    expect(roundMetric(7.3)).toBe(7.5);
    expect(roundMetric(42.4)).toBe(42);
    // Nobody weighs 237 g of flour.
    expect(roundMetric(237)).toBe(235);
    expect(roundMetric(1333)).toBe(1325);
  });
});

describe('roundCount', () => {
  it('rounds whole things, allowing halves', () => {
    expect(roundCount(2.4)).toBe(2.5);
    expect(roundCount(2.1)).toBe(2);
    expect(roundCount(3)).toBe(3);
  });

  it('never rounds a needed ingredient down to nothing', () => {
    // Half an onion is a real instruction; zero onions is a different recipe.
    expect(roundCount(0.2)).toBe(0.5);
    expect(roundCount(0.4)).toBe(0.5);
  });
});

describe('roundQuantityForUnit', () => {
  it('uses metric steps for weights and volumes', () => {
    expect(roundQuantityForUnit(237, 'g')).toBe(235);
    expect(roundQuantityForUnit(333, 'ml')).toBe(335);
  });

  it('uses cooking fractions for spoons and cups', () => {
    expect(roundQuantityForUnit(1.3333, 'cup')).toBeCloseTo(1 + 1 / 3, 5);
    expect(roundQuantityForUnit(0.52, 'tsp')).toBeCloseTo(0.5, 5);
  });

  it('uses whole counts for countable things', () => {
    expect(roundQuantityForUnit(2.4, 'clove')).toBe(2.5);
    expect(roundQuantityForUnit(1.1, 'piece')).toBe(1);
  });

  it('returns zero for a unit that carries no quantity', () => {
    expect(roundQuantityForUnit(5, 'to_taste')).toBe(0);
  });

  it('rejects nonsense instead of propagating it', () => {
    expect(roundQuantityForUnit(Number.NaN, 'g')).toBe(0);
    expect(roundQuantityForUnit(-5, 'g')).toBe(0);
  });
});

describe('formatUnit', () => {
  it('does not pluralize short metric symbols', () => {
    expect(formatUnit('g', 200)).toBe('g');
    expect(formatUnit('ml', 500)).toBe('ml');
    expect(formatUnit('kg', 2)).toBe('kg');
    expect(formatUnit('tsp', 3)).toBe('tsp');
  });

  it('pluralizes word units', () => {
    expect(formatUnit('cup', 2)).toBe('cups');
    expect(formatUnit('cup', 1)).toBe('cup');
    expect(formatUnit('clove', 3)).toBe('cloves');
    expect(formatUnit('pinch', 2)).toBe('pinches');
  });

  it('renders to_taste as its own phrase', () => {
    expect(formatUnit('to_taste', null)).toBe('to taste');
  });

  it('returns nothing for a missing unit', () => {
    expect(formatUnit(null, 2)).toBe('');
  });
});

describe('formatIngredientAmount', () => {
  it('writes metric amounts tightly, as a recipe would', () => {
    expect(formatIngredientAmount(200, 'g')).toBe('200g');
    expect(formatIngredientAmount(1.5, 'kg')).toBe('1.5kg');
    expect(formatIngredientAmount(500, 'ml')).toBe('500ml');
  });

  it('writes fractions rather than decimals for cups and spoons', () => {
    expect(formatIngredientAmount(1.3333, 'cup')).toBe('1 1/3 cups');
    expect(formatIngredientAmount(0.5, 'tsp')).toBe('1/2 tsp');
    expect(formatIngredientAmount(0.75, 'cup')).toBe('3/4 cup');
    expect(formatIngredientAmount(2.5, 'tbsp')).toBe('2 1/2 tbsp');
  });

  it('writes whole counts plainly', () => {
    expect(formatIngredientAmount(2, 'clove')).toBe('2 cloves');
    expect(formatIngredientAmount(1, 'piece')).toBe('1 piece');
  });

  it('writes to_taste with no number at all', () => {
    expect(formatIngredientAmount(null, 'to_taste')).toBe('to taste');
    // Even if a quantity sneaks in, the number is not shown.
    expect(formatIngredientAmount(2, 'to_taste')).toBe('to taste');
  });

  it('handles a missing quantity with a known unit', () => {
    expect(formatIngredientAmount(null, 'cup')).toBe('cup');
  });

  it('handles a quantity with no unit', () => {
    expect(formatIngredientAmount(3, null)).toBe('3');
  });

  it('returns an empty string when there is nothing to show', () => {
    expect(formatIngredientAmount(null, null)).toBe('');
  });

  it('never shows a long decimal tail from scaling', () => {
    for (const unit of RECIPE_UNITS) {
      const text = formatIngredientAmount(1 / 3, unit);
      expect(text).not.toMatch(/\d\.\d{3,}/);
    }
  });
});
