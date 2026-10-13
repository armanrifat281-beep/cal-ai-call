import type { RecipeIngredient } from '@/types/recipe';

import { describePantryMatch, matchPantry } from '../pantry';

function ingredient(name: string): RecipeIngredient {
  return {
    id: name,
    name,
    quantity: 1,
    unit: 'g',
    preparation: null,
    group: null,
    substitution: null,
    scalesWithServings: true,
  } as RecipeIngredient;
}

function namesOf(ingredients: readonly RecipeIngredient[]): string[] {
  return ingredients.map((item) => item.name);
}

describe('matching a recipe against what is in the kitchen', () => {
  it('finds an exact ingredient', () => {
    const match = matchPantry([ingredient('Basmati rice')], ['basmati rice']);

    expect(namesOf(match.available)).toEqual(['Basmati rice']);
    expect(match.missing).toHaveLength(0);
  });

  it('ignores case and surrounding words', () => {
    const match = matchPantry([ingredient('Chicken thighs')], ['Chicken']);

    expect(namesOf(match.available)).toEqual(['Chicken thighs']);
  });

  it('treats a simple plural as the same food', () => {
    const match = matchPantry([ingredient('Eggs')], ['egg']);

    expect(namesOf(match.available)).toEqual(['Eggs']);
  });

  /*
    The expensive direction to be wrong in is claiming the user HAS
    something: they find out at the stove. Claiming they do not costs a
    glance at their own shelf, so every uncertain case lands in `missing`.
  */
  it('reports anything it cannot match as missing, rather than guessing', () => {
    const match = matchPantry(
      [ingredient('Scallions'), ingredient('Gochujang')],
      ['spring onions'],
    );

    expect(match.available).toHaveLength(0);
    expect(namesOf(match.missing)).toEqual(['Scallions', 'Gochujang']);
  });

  /*
    Without the ignore list, "olive oil" in the pantry matches "vegetable
    oil" in the recipe. The shared word is real, but it is not the food.
  */
  it('does not match two foods on a shared noise word', () => {
    expect(matchPantry([ingredient('Vegetable oil')], ['Olive oil']).missing)
      .toHaveLength(1);
    expect(matchPantry([ingredient('Fresh basil')], ['Fresh ginger']).missing)
      .toHaveLength(1);
    expect(matchPantry([ingredient('Tomato paste')], ['Curry paste']).missing)
      .toHaveLength(1);
  });

  it('matches a real food word even when noise words surround it', () => {
    const match = matchPantry([ingredient('Fresh ginger')], ['ginger, grated']);

    expect(namesOf(match.available)).toEqual(['Fresh ginger']);
  });

  it('treats an empty pantry as knowing nothing, not as owning nothing', () => {
    const match = matchPantry([ingredient('Rice'), ingredient('Salt')], []);

    expect(match.available).toHaveLength(0);
    expect(match.missing).toHaveLength(2);
    // The caller shows nothing in this case; the sentence is what it hides.
    expect(describePantryMatch(match)).toContain('missing');
  });

  it('ignores blank pantry entries rather than matching everything', () => {
    const match = matchPantry([ingredient('Rice')], ['   ', '!!']);

    expect(match.missing).toHaveLength(1);
  });
});

describe('what the user is told', () => {
  it('names what is missing, so a shopping trip is one list', () => {
    const match = matchPantry(
      [ingredient('Rice'), ingredient('Chicken'), ingredient('Yoghurt')],
      ['rice'],
    );

    expect(describePantryMatch(match)).toBe(
      'You have 1 of 3 — missing chicken, yoghurt.',
    );
  });

  it('says so plainly when nothing is missing', () => {
    const match = matchPantry([ingredient('Rice')], ['rice']);

    expect(describePantryMatch(match)).toBe(
      'You have the one ingredient this needs.',
    );
  });

  it('says nothing about a recipe with no ingredients', () => {
    expect(describePantryMatch(matchPantry([], ['rice']))).toBeNull();
  });
});
