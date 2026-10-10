import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';
import { EMPTY_NUTRIENTS, type FoodEntryItem } from '@/types/domain';

import { MealEditor, mealTypeForHour, type MealDraft } from '../MealEditor';

function existingItem(overrides: Partial<FoodEntryItem> = {}): FoodEntryItem {
  return {
    id: 'item-1',
    name: 'Oat porridge',
    brand: null,
    portion: { quantity: 250, unit: 'g' },
    gramsResolved: 250,
    nutrients: { ...EMPTY_NUTRIENTS, caloriesKcal: 180, proteinG: 6, carbsG: 30, fatG: 3 },
    provenance: {
      source: 'database',
      confidence: 'high',
      providerLabel: 'USDA FoodData Central',
      providerRef: '123',
    },
    foodRecordId: 'usda:123',
    notes: null,
    ...overrides,
  };
}

describe('mealTypeForHour', () => {
  it('maps the clock to a sensible default meal', () => {
    expect(mealTypeForHour(7)).toBe('breakfast');
    expect(mealTypeForHour(10)).toBe('breakfast');
    expect(mealTypeForHour(12)).toBe('lunch');
    expect(mealTypeForHour(14)).toBe('lunch');
    expect(mealTypeForHour(19)).toBe('dinner');
    expect(mealTypeForHour(22)).toBe('snack');
    expect(mealTypeForHour(2)).toBe('breakfast');
  });
});

describe('MealEditor validation', () => {
  it('refuses to save an empty meal and says why', async () => {
    const onSave = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor mode="create" saving={false} saveError={null} onSave={onSave} />,
    );

    await user.press(screen.getByRole('button', { name: 'Save meal' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Add at least one food to save this meal.')).toBeTruthy();
  });

  it('refuses to save while a food has no name', async () => {
    const onSave = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor mode="create" saving={false} saveError={null} onSave={onSave} />,
    );

    await user.press(screen.getByRole('button', { name: 'Add food' }));
    await user.press(screen.getByRole('button', { name: 'Save meal' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('1 food still need a name.')).toBeTruthy();
  });
});

describe('MealEditor saving', () => {
  it('saves a meal the user filled in by hand', async () => {
    const onSave = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor mode="create" saving={false} saveError={null} onSave={onSave} />,
    );

    await user.press(screen.getByRole('button', { name: 'Add food' }));

    // The new item opens expanded, so its fields are on screen.
    await user.type(screen.getByLabelText('Food'), 'Scrambled eggs');
    await user.clear(screen.getByLabelText('Calories'));
    await user.type(screen.getByLabelText('Calories'), '210');
    await user.clear(screen.getByLabelText('Protein (g)'));
    await user.type(screen.getByLabelText('Protein (g)'), '14');

    await user.type(screen.getByLabelText('Meal name'), 'Breakfast eggs');
    await user.press(screen.getByRole('button', { name: 'Save meal' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const draft = onSave.mock.calls[0]?.[0] as MealDraft;
    expect(draft.title).toBe('Breakfast eggs');
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]?.name).toBe('Scrambled eggs');
    expect(draft.items[0]?.nutrients.caloriesKcal).toBe(210);
    expect(draft.items[0]?.nutrients.proteinG).toBe(14);
    // A hand-typed number is recorded as the user's, not a database value.
    expect(draft.items[0]?.provenance.source).toBe('user_entered');
    expect(new Date(draft.consumedAt).getTime()).not.toBeNaN();
  });

  it('names an untitled meal after its contents', async () => {
    const onSave = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor
        mode="create"
        initial={{ items: [existingItem({ name: 'Rice' }), existingItem({ id: 'i2', name: 'Chicken' })] }}
        saving={false}
        saveError={null}
        onSave={onSave}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Save meal' }));

    const draft = onSave.mock.calls[0]?.[0] as MealDraft;
    expect(draft.title).toBe('Rice, Chicken');
  });

  it('keeps database provenance when only the meal name is edited', async () => {
    const onSave = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor
        mode="edit"
        initial={{ title: 'Porridge', items: [existingItem()] }}
        saving={false}
        saveError={null}
        onSave={onSave}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Save changes' }));

    const draft = onSave.mock.calls[0]?.[0] as MealDraft;
    expect(draft.items[0]?.provenance.source).toBe('database');
    expect(draft.items[0]?.provenance.providerLabel).toBe('USDA FoodData Central');
  });

  it("records a corrected nutrient value as the user's own, not the database", async () => {
    const onSave = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor
        mode="edit"
        initial={{ title: 'Porridge', items: [existingItem()] }}
        saving={false}
        saveError={null}
        onSave={onSave}
      />,
    );

    // Open the item, then correct its calories.
    await user.press(screen.getByRole('button', { name: 'Edit this food' }));
    await user.clear(screen.getByLabelText('Calories'));
    await user.type(screen.getByLabelText('Calories'), '240');
    await user.press(screen.getByRole('button', { name: 'Save changes' }));

    const draft = onSave.mock.calls[0]?.[0] as MealDraft;
    expect(draft.items[0]?.nutrients.caloriesKcal).toBe(240);
    expect(draft.items[0]?.provenance.source).toBe('user_entered');
  });

  it('removes a food from the meal', async () => {
    const onSave = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor
        mode="edit"
        initial={{ title: 'Two foods', items: [existingItem(), existingItem({ id: 'i2', name: 'Banana' })] }}
        saving={false}
        saveError={null}
        onSave={onSave}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Remove Banana' }));
    await user.press(screen.getByRole('button', { name: 'Save changes' }));

    const draft = onSave.mock.calls[0]?.[0] as MealDraft;
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]?.name).toBe('Oat porridge');
  });

  it('shows a save error and offers a retry', async () => {
    await renderWithProviders(
      <MealEditor
        mode="create"
        initial={{ items: [existingItem()] }}
        saving={false}
        saveError={{
          code: 'network',
          message: 'No connection. Check your internet and try again.',
          retryable: true,
        }}
        onSave={jest.fn()}
      />,
    );

    expect(screen.getByText('No connection. Check your internet and try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try saving again' })).toBeTruthy();
  });

  it('blocks a second submit while a save is in flight', async () => {
    const onSave = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor
        mode="create"
        initial={{ items: [existingItem()] }}
        saving
        saveError={null}
        onSave={onSave}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Save meal' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('MealEditor warnings', () => {
  it('warns when calories contradict the macros', async () => {
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor
        mode="edit"
        initial={{
          title: 'Odd meal',
          items: [
            existingItem({
              nutrients: {
                ...EMPTY_NUTRIENTS,
                caloriesKcal: 1200,
                proteinG: 5,
                carbsG: 10,
                fatG: 3,
              },
            }),
          ],
        }}
        saving={false}
        saveError={null}
        onSave={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Edit this food' }));
    expect(screen.getByText('These numbers do not add up')).toBeTruthy();
  });
});
