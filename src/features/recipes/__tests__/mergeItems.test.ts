import type { ShoppingListItem } from '@/types/recipe';

import { planShoppingMerge, shoppingMergeKey } from '../mergeItems';

function line(
  id: string,
  name: string,
  quantity: number | null,
  unit: ShoppingListItem['unit'] = 'g',
): ShoppingListItem {
  return {
    id,
    listId: 'list-1',
    name,
    quantity,
    unit,
    category: null,
    isChecked: false,
    note: null,
    position: 0,
    sourceRecipeId: null,
    createdAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  };
}

describe('shoppingMergeKey', () => {
  it('ignores case and surrounding space', () => {
    expect(shoppingMergeKey('  Red Onions ', 'g')).toBe(shoppingMergeKey('red onions', 'g'));
  });

  it('keeps different units apart', () => {
    // Two cloves and two grams of garlic are not four of anything.
    expect(shoppingMergeKey('garlic', 'clove')).not.toBe(shoppingMergeKey('garlic', 'g'));
  });

  it('treats no unit as its own kind', () => {
    expect(shoppingMergeKey('onion', null)).not.toBe(shoppingMergeKey('onion', 'g'));
  });
});

describe('planShoppingMerge', () => {
  it('inserts a line the list does not have', () => {
    const plan = planShoppingMerge([], [{ name: 'Onion', quantity: 2, unit: 'piece' }]);

    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]?.input.name).toBe('Onion');
    expect(plan.inserts[0]?.position).toBe(0);
  });

  it('adds the amounts when the same food and unit are already there', () => {
    const plan = planShoppingMerge(
      [line('a', 'Onion', 2, 'piece')],
      [{ name: 'onion', quantity: 3, unit: 'piece' }],
    );

    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([{ id: 'a', quantity: 5 }]);
  });

  it('keeps a separate line when the unit differs', () => {
    const plan = planShoppingMerge(
      [line('a', 'Garlic', 2, 'clove')],
      [{ name: 'Garlic', quantity: 30, unit: 'g' }],
    );

    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toHaveLength(1);
  });

  it('does not invent a total when one side has no amount', () => {
    // "2 onions" plus "onions, to taste" is not 2 of anything certain, and
    // it is certainly not 2 plus nothing.
    const plan = planShoppingMerge(
      [line('a', 'Onion', 2, 'piece')],
      [{ name: 'Onion', unit: 'piece' }],
    );
    expect(plan.updates).toEqual([{ id: 'a', quantity: 2 }]);
  });

  it('takes the known amount when the stored line had none', () => {
    const plan = planShoppingMerge(
      [line('a', 'Onion', null, 'piece')],
      [{ name: 'Onion', quantity: 3, unit: 'piece' }],
    );
    expect(plan.updates).toEqual([{ id: 'a', quantity: 3 }]);
  });

  it('leaves both unknown when neither side has an amount', () => {
    const plan = planShoppingMerge(
      [line('a', 'Salt', null, null)],
      [{ name: 'Salt' }],
    );
    expect(plan.updates).toEqual([{ id: 'a', quantity: null }]);
  });

  it('accumulates duplicates within one batch into the existing line', () => {
    // Two recipes added together, each needing an onion.
    const plan = planShoppingMerge(
      [line('a', 'Onion', 1, 'piece')],
      [
        { name: 'Onion', quantity: 2, unit: 'piece' },
        { name: 'Onion', quantity: 3, unit: 'piece' },
      ],
    );

    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([{ id: 'a', quantity: 6 }]);
  });

  it('inserts a new food only once when the batch repeats it', () => {
    const plan = planShoppingMerge(
      [],
      [
        { name: 'Onion', quantity: 2, unit: 'piece' },
        { name: 'Onion', quantity: 3, unit: 'piece' },
      ],
    );
    expect(plan.inserts).toHaveLength(1);
  });

  it('positions new lines after the ones already there', () => {
    const plan = planShoppingMerge(
      [line('a', 'Onion', 1), line('b', 'Rice', 500)],
      [{ name: 'Garlic' }, { name: 'Ginger' }],
    );
    expect(plan.inserts.map((insert) => insert.position)).toEqual([2, 3]);
  });

  it('skips a blank name rather than making an empty line', () => {
    const plan = planShoppingMerge([], [{ name: '   ' }, { name: 'Rice' }]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]?.input.name).toBe('Rice');
  });

  it('trims the name it inserts', () => {
    const plan = planShoppingMerge([], [{ name: '  Basmati rice  ' }]);
    expect(plan.inserts[0]?.input.name).toBe('Basmati rice');
  });

  it('plans nothing for an empty batch', () => {
    const plan = planShoppingMerge([line('a', 'Onion', 1)], []);
    expect(plan).toEqual({ updates: [], inserts: [] });
  });
});
