import type { PortionOption } from '@/types/domain';

import {
  ASSUMED_G_PER_ML,
  GRAMS_PER_OUNCE,
  formatPortion,
  gramsToOunces,
  isSelfContainedUnit,
  portionToGrams,
} from '../units';

const APPLE_OPTIONS: PortionOption[] = [
  { unit: 'piece', label: 'medium apple', gramsPerUnit: 182 },
  { unit: 'cup', label: '1 cup, chopped', gramsPerUnit: 125 },
];

describe('portionToGrams', () => {
  it('passes grams through unchanged', () => {
    expect(portionToGrams({ quantity: 150, unit: 'g' })).toEqual({
      grams: 150,
      assumedDensity: false,
      usedOption: null,
    });
  });

  it('converts ounces using the avoirdupois definition', () => {
    const result = portionToGrams({ quantity: 4, unit: 'oz' });
    expect(result?.grams).toBeCloseTo(4 * GRAMS_PER_OUNCE, 10);
    expect(result?.grams).toBeCloseTo(113.398, 3);
    expect(result?.assumedDensity).toBe(false);
  });

  it('uses a record-supplied gram weight for household measures', () => {
    const result = portionToGrams({ quantity: 2, unit: 'piece' }, APPLE_OPTIONS);
    expect(result?.grams).toBe(364);
    expect(result?.usedOption?.label).toBe('medium apple');
  });

  it('handles fractional quantities of household measures', () => {
    const result = portionToGrams({ quantity: 0.5, unit: 'cup' }, APPLE_OPTIONS);
    expect(result?.grams).toBe(62.5);
  });

  it('returns null when a household measure has no gram weight for this food', () => {
    expect(portionToGrams({ quantity: 1, unit: 'slice' }, APPLE_OPTIONS)).toBeNull();
    expect(portionToGrams({ quantity: 1, unit: 'serving' })).toBeNull();
    expect(portionToGrams({ quantity: 1, unit: 'tbsp' })).toBeNull();
  });

  it('ignores a portion option whose gram weight is not positive', () => {
    const broken: PortionOption[] = [{ unit: 'piece', label: 'bad', gramsPerUnit: 0 }];
    expect(portionToGrams({ quantity: 1, unit: 'piece' }, broken)).toBeNull();
  });

  it('falls back to water density for ml and flags the assumption', () => {
    const result = portionToGrams({ quantity: 250, unit: 'ml' });
    expect(result).toEqual({
      grams: 250 * ASSUMED_G_PER_ML,
      assumedDensity: true,
      usedOption: null,
    });
  });

  it('prefers a record-supplied ml weight over the density assumption', () => {
    const oil: PortionOption[] = [{ unit: 'ml', label: '1 ml oil', gramsPerUnit: 0.92 }];
    const result = portionToGrams({ quantity: 100, unit: 'ml' }, oil);
    expect(result?.grams).toBeCloseTo(92, 10);
    expect(result?.assumedDensity).toBe(false);
  });

  it('rejects quantities that are not positive finite numbers', () => {
    expect(portionToGrams({ quantity: 0, unit: 'g' })).toBeNull();
    expect(portionToGrams({ quantity: -5, unit: 'g' })).toBeNull();
    expect(portionToGrams({ quantity: Number.NaN, unit: 'g' })).toBeNull();
    expect(portionToGrams({ quantity: Number.POSITIVE_INFINITY, unit: 'g' })).toBeNull();
  });
});

describe('isSelfContainedUnit', () => {
  it('is true only for grams and ounces', () => {
    expect(isSelfContainedUnit('g')).toBe(true);
    expect(isSelfContainedUnit('oz')).toBe(true);
    expect(isSelfContainedUnit('ml')).toBe(false);
    expect(isSelfContainedUnit('cup')).toBe(false);
  });
});

describe('gramsToOunces', () => {
  it('round-trips with the ounce constant', () => {
    expect(gramsToOunces(GRAMS_PER_OUNCE)).toBeCloseTo(1, 10);
    expect(gramsToOunces(100)).toBeCloseTo(3.5274, 4);
  });
});

describe('formatPortion', () => {
  it('formats absolute units with a space', () => {
    expect(formatPortion({ quantity: 150, unit: 'g' })).toBe('150 g');
    expect(formatPortion({ quantity: 250, unit: 'ml' })).toBe('250 ml');
    expect(formatPortion({ quantity: 4, unit: 'oz' })).toBe('4 oz');
  });

  it('pluralizes household measures', () => {
    expect(formatPortion({ quantity: 1, unit: 'piece' })).toBe('1 piece');
    expect(formatPortion({ quantity: 3, unit: 'piece' })).toBe('3 pieces');
    expect(formatPortion({ quantity: 2, unit: 'cup' })).toBe('2 cups');
  });

  it('keeps one decimal for fractional quantities', () => {
    expect(formatPortion({ quantity: 0.5, unit: 'cup' })).toBe('0.5 cups');
    expect(formatPortion({ quantity: 1.5, unit: 'tbsp' })).toBe('1.5 tbsps');
  });
});
