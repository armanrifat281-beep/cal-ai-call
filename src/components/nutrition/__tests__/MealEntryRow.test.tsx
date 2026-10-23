import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';
import { EMPTY_NUTRIENTS, type FoodEntry } from '@/types/domain';

import { MealEntryRow } from '../MealEntryRow';

function entryOf(items: number): FoodEntry {
  return {
    id: 'e1',
    userId: 'u1',
    consumedAt: '2026-10-22T08:00:00.000Z',
    mealType: 'breakfast',
    title: 'Scrambled eggs and greens',
    items: Array.from({ length: items }, (_, index) => ({
      id: `i${index}`,
      name: 'Scrambled eggs',
      brand: null,
      portion: { quantity: 2, unit: 'piece' as const },
      gramsResolved: 100,
      nutrients: { ...EMPTY_NUTRIENTS, caloriesKcal: 218, proteinG: 10, carbsG: 5, fatG: 16 },
      provenance: {
        source: 'user_entered' as const,
        confidence: 'high' as const,
        providerLabel: null,
        providerRef: null,
      },
      foodRecordId: null,
      notes: null,
    })),
    photoPath: null,
    notes: null,
    createdAt: '2026-10-22T08:00:00.000Z',
    updatedAt: '2026-10-22T08:00:00.000Z',
  };
}

/**
 * The row carries two controls, and they have to stay apart.
 *
 * It used to be one pressable with the stepper nested inside it - a button
 * inside a button. React Native lets that render, so nothing failed; what
 * happened instead was that taking a portion off a meal could also open it,
 * which on a phone reads as the app doing something at random.
 */
describe('a meal row', () => {
  it('steps the portion without also opening the meal', async () => {
    const onPress = jest.fn();
    const onChangeServings = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEntryRow
        entry={entryOf(1)}
        onPress={onPress}
        onChangeServings={onChangeServings}
      />,
    );

    await user.press(
      screen.getByRole('button', { name: 'More Scrambled eggs and greens' }),
    );

    expect(onChangeServings).toHaveBeenCalledWith(3);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('opens the meal when the row itself is pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEntryRow entry={entryOf(1)} onPress={onPress} onChangeServings={jest.fn()} />,
    );

    await user.press(
      screen.getByRole('button', {
        name: 'Scrambled eggs and greens, 218 kilocalories',
      }),
    );

    expect(onPress).toHaveBeenCalled();
  });

  /*
    A meal of several foods has no single number to step - "2" of a bowl
    containing eggs, salad and oil means nothing - so it gets a chevron and
    sends the user to the record, where each food can be changed on its own.
  */
  it('offers no stepper for a meal of several foods', async () => {
    await renderWithProviders(
      <MealEntryRow entry={entryOf(3)} onPress={jest.fn()} onChangeServings={jest.fn()} />,
    );

    expect(
      screen.queryByRole('button', { name: /^More / }),
    ).toBeNull();
    expect(screen.getByText('3 items')).toBeTruthy();
  });
});
