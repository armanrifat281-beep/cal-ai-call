import { toPer100g, validateLabel } from '../schema';

/** A believable answer from the model for a biscuit packet. */
const READING = {
  readable: true,
  productName: 'Digestive Biscuits',
  brand: 'Olympic',
  servingSize: '2 biscuits (30 g)',
  servingGrams: 30,
  basis: 'per_100g',
  nutrients: {
    caloriesKcal: 480,
    proteinG: 6.5,
    carbsG: 62,
    fatG: 22,
    saturatedFatG: 11,
    sugarG: 17,
    addedSugarG: null,
    fiberG: 3.1,
    sodiumMg: 600,
  },
  ingredients: ['wheat flour', 'sugar', 'palm oil'],
  declaredAllergens: ['wheat'],
  uncertain: [],
};

describe('validateLabel', () => {
  it('accepts a complete reading as it stands', () => {
    const result = validateLabel(READING);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productName).toBe('Digestive Biscuits');
    expect(result.value.nutrients.sugarG).toBe(17);
    expect(result.value.basis).toBe('per_100g');
  });

  /*
    The rule the whole feature rests on. A label is a primary source: what
    it does not print, nobody knows. A derived "added sugar" figure would be
    indistinguishable on screen from one the manufacturer published.
  */
  it('keeps added sugar null when the label did not print it', () => {
    const result = validateLabel(READING);
    expect(result.ok && result.value.nutrients.addedSugarG).toBeNull();
  });

  it('keeps added sugar when the label did print it', () => {
    const result = validateLabel({
      ...READING,
      nutrients: { ...READING.nutrients, addedSugarG: 12 },
    });
    expect(result.ok && result.value.nutrients.addedSugarG).toBe(12);
  });

  /*
    A model that is merely unsure sets `readable: false` and then reports
    every figure on the panel anyway. Throwing that away - which is what
    used to happen - discarded a good reading of a real label, and the user
    was told their photo was unreadable when it had been read perfectly.
  */
  it('keeps a reading the model flagged but filled in anyway', () => {
    const result = validateLabel({ ...READING, readable: false });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nutrients.sugarG).toBe(17);
  });

  // "I could not read this" is a useful answer when there is nothing
  // behind it, and must not be dressed up as a reading of empty fields.
  it('refuses a photo that is not a panel and has no figures', () => {
    const result = validateLabel({
      ...READING,
      readable: false,
      nutrients: {
        caloriesKcal: null, proteinG: null, carbsG: null, fatG: null,
        saturatedFatG: null, sugarG: null, addedSugarG: null,
        fiberG: null, sodiumMg: null,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('not a nutrition panel');
  });

  it('refuses a reading with no figures on it at all', () => {
    const result = validateLabel({
      ...READING,
      nutrients: {
        caloriesKcal: null, proteinG: null, carbsG: null, fatG: null,
        saturatedFatG: null, sugarG: null, addedSugarG: null,
        fiberG: null, sodiumMg: null,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('no nutrition figures');
  });

  /*
    Dropped, not clamped. A clamped figure is a made-up one wearing the
    clothes of a measurement, and the screen would print it as if the
    packet had said it.
  */
  it('drops an impossible figure instead of clamping it', () => {
    const result = validateLabel({
      ...READING,
      nutrients: { ...READING.nutrients, proteinG: -5, fatG: 9000 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nutrients.proteinG).toBeNull();
    expect(result.value.nutrients.fatG).toBeNull();
    // The rest of the panel still stands.
    expect(result.value.nutrients.carbsG).toBe(62);
  });

  it('carries the fields the model was unsure of', () => {
    const result = validateLabel({ ...READING, uncertain: ['sodiumMg'] });
    expect(result.ok && result.value.uncertain).toEqual(['sodiumMg']);
  });

  it('treats an unknown basis as per 100 g, which is how panels publish', () => {
    const result = validateLabel({ ...READING, basis: 'per_packet' });
    expect(result.ok && result.value.basis).toBe('per_100g');
  });

  it('rejects something that is not an object at all', () => {
    expect(validateLabel('nope').ok).toBe(false);
    expect(validateLabel(null).ok).toBe(false);
  });
});

describe('toPer100g', () => {
  it('scales a per-serving panel by the serving weight', () => {
    const per100g = toPer100g(
      { ...READING.nutrients, caloriesKcal: 144, sugarG: 5.1 },
      30,
    );

    expect(per100g?.caloriesKcal).toBe(480);
    expect(per100g?.sugarG).toBe(17);
  });

  // Without a serving weight there is no conversion, only a guess, and a
  // guess here changes every number on the screen at once.
  it('refuses to convert without a serving weight', () => {
    expect(toPer100g(READING.nutrients, null)).toBeNull();
    expect(toPer100g(READING.nutrients, 0)).toBeNull();
  });

  it('leaves a missing figure missing', () => {
    const per100g = toPer100g({ ...READING.nutrients, fiberG: null }, 50);
    expect(per100g?.fiberG).toBeNull();
  });
});
