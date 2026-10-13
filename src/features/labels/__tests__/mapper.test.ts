import {
  readAllergens,
  readIngredients,
  readServingGrams,
  toProductLabel,
  type OffResponse,
} from '../mapper';

function response(product: Record<string, unknown>): OffResponse {
  return { status: 1, product };
}

/**
 * Reading a product record without improving on it.
 *
 * A label is a primary source: what it does not say, nobody knows. The
 * failure these guard against is the quiet one - a plausible figure filled
 * into a gap, which still looks like a fact to the person reading it.
 */
describe('reading a product record', () => {
  it('reads the figures that are there', () => {
    const lookup = toProductLabel('123', response({
      product_name: 'Oat bars',
      brands: 'Someone',
      nutriments: {
        'energy-kcal_100g': 410,
        proteins_100g: 7.1,
        carbohydrates_100g: 60,
        fat_100g: 14,
      },
    }));

    expect(lookup?.product.name).toBe('Oat bars');
    expect(lookup?.product.per100g.caloriesKcal).toBe(410);
    expect(lookup?.product.per100g.proteinG).toBe(7.1);
    expect(lookup?.gaps.missingNutrition).toBe(false);
  });

  /*
    The four core figures cannot be null in `Nutrients`, so an absent one
    becomes 0 - which looks exactly like a genuine zero. `missingNutrients`
    is how the screen tells them apart, so it has to be right.
  */
  it('reports an absent figure as missing rather than as zero', () => {
    const lookup = toProductLabel('123', response({
      product_name: 'Mystery jar',
      nutriments: { 'energy-kcal_100g': 120 },
    }));

    expect(lookup?.product.per100g.proteinG).toBe(0);
    expect(lookup?.gaps.missingNutrients).toContain('proteinG');
    expect(lookup?.gaps.missingNutrients).not.toContain('caloriesKcal');
  });

  it('converts kilojoules when that is all the label gives', () => {
    const lookup = toProductLabel('123', response({
      product_name: 'Euro snack',
      nutriments: { energy_100g: 2092, proteins_100g: 5, carbohydrates_100g: 1, fat_100g: 1 },
    }));

    // 2092 / 4.184 = 500 exactly. A unit change, not an estimate.
    expect(Math.round(lookup?.product.per100g.caloriesKcal ?? 0)).toBe(500);
  });

  it('derives sodium from salt, which is chemistry rather than a guess', () => {
    const lookup = toProductLabel('123', response({
      product_name: 'Crisps',
      nutriments: {
        'energy-kcal_100g': 500,
        proteins_100g: 6,
        carbohydrates_100g: 50,
        fat_100g: 30,
        salt_100g: 1.5,
      },
    }));

    // 1.5 g salt x 0.3934 x 1000 = 590 mg sodium.
    expect(Math.round(lookup?.product.per100g.sodiumMg ?? 0)).toBe(590);
  });

  it('prefers a stated sodium figure over deriving one', () => {
    const lookup = toProductLabel('123', response({
      product_name: 'Crisps',
      nutriments: {
        'energy-kcal_100g': 500,
        proteins_100g: 6,
        carbohydrates_100g: 50,
        fat_100g: 30,
        sodium_100g: 0.4,
        salt_100g: 1.5,
      },
    }));

    expect(lookup?.product.per100g.sodiumMg).toBe(400);
  });

  it('refuses a record with no name and no nutrition', () => {
    expect(toProductLabel('123', response({ nutriments: {} }))).toBeNull();
  });

  it('refuses a product the database does not have', () => {
    expect(toProductLabel('123', { status: 0 })).toBeNull();
  });

  it('keeps a product that has a name but no nutrition, and says so', () => {
    const lookup = toProductLabel('123', response({ product_name: 'Unlabelled tin' }));

    expect(lookup?.product.name).toBe('Unlabelled tin');
    expect(lookup?.gaps.missingNutrition).toBe(true);
  });
});

describe('the ingredient list', () => {
  it('splits on commas', () => {
    expect(readIngredients('Oats, sugar, salt')).toEqual(['Oats', 'sugar', 'salt']);
  });

  /*
    "chocolate (sugar, cocoa butter)" is one ingredient with a sub-list.
    Split naively it becomes three, two of which are not ingredients of the
    product at all.
  */
  it('keeps a bracketed sub-list with its ingredient', () => {
    expect(readIngredients('Oats, chocolate (sugar, cocoa butter), salt')).toEqual([
      'Oats',
      'chocolate (sugar, cocoa butter)',
      'salt',
    ]);
  });

  it('returns nothing when the label was not read', () => {
    expect(readIngredients(undefined)).toEqual([]);
    expect(readIngredients('   ')).toEqual([]);
  });
});

describe('allergens', () => {
  it('reads the declared list, stripping the language prefix', () => {
    expect(readAllergens(['en:milk', 'en:tree-nuts'])).toEqual(['milk', 'tree nuts']);
  });

  /*
    Only what the packaging declares. "Contains milk" is a statement by the
    manufacturer; spotting whey in the ingredient list is this app guessing,
    and somebody with an allergy could be harmed by the difference.
  */
  it('reads nothing from the ingredient text', () => {
    const lookup = toProductLabel('123', response({
      product_name: 'Biscuits',
      ingredients_text: 'Wheat flour, whey powder, peanuts',
      nutriments: { 'energy-kcal_100g': 480, proteins_100g: 7, carbohydrates_100g: 60, fat_100g: 22 },
    }));

    expect(lookup?.product.declaredAllergens).toEqual([]);
    expect(lookup?.gaps.missingAllergens).toBe(true);
  });
});

describe('serving size', () => {
  it('uses the stated quantity', () => {
    expect(readServingGrams({ serving_quantity: 45 })).toBe(45);
  });

  it('reads grams out of the printed text', () => {
    expect(readServingGrams({ serving_size: '1 bar (45 g)' })).toBe(45);
    expect(readServingGrams({ serving_size: '30g' })).toBe(30);
  });

  it('gives up rather than guessing an unparsable serving', () => {
    expect(readServingGrams({ serving_size: '1 cup' })).toBeNull();
    expect(readServingGrams({})).toBeNull();
  });
});
