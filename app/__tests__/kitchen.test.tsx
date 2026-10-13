import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';
import { usePreferencesStore } from '@/store/preferencesStore';

import KitchenScreen from '../settings/kitchen';

/**
 * The list that makes "cook with what you have" mean anything.
 *
 * Typed once and thrown away, it had to be retyped for every recipe, and no
 * saved recipe could say what was missing. These cover the two things that
 * have to hold: what is typed is what gets stored, and the screen never
 * implies the matching is cleverer than it is.
 */
beforeEach(() => {
  usePreferencesStore.getState().reset();
});

describe('the kitchen list', () => {
  it('stores what was typed, split on commas', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<KitchenScreen />);

    await user.type(
      screen.getByLabelText('Ingredients at home'),
      'rice, eggs, onions',
    );
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(usePreferencesStore.getState().preferences.pantryItems).toEqual([
      'rice',
      'eggs',
      'onions',
    ]);
  });

  it('drops blanks and duplicates rather than matching them twice', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<KitchenScreen />);

    await user.type(
      screen.getByLabelText('Ingredients at home'),
      'rice, , Rice, eggs,',
    );
    await user.press(screen.getByRole('button', { name: 'Save' }));

    const stored = usePreferencesStore.getState().preferences.pantryItems;
    expect(stored).toHaveLength(2);
    expect(stored.map((item) => item.toLowerCase())).toEqual(['rice', 'eggs']);
  });

  it('opens with the list already saved, rather than blank', async () => {
    usePreferencesStore.getState().setPantryItems(['yoghurt', 'cumin']);

    await renderWithProviders(<KitchenScreen />);

    expect(screen.getByDisplayValue('yoghurt, cumin')).toBeTruthy();
  });

  /*
    The matching is literal and will miss synonyms. Saying so is what makes
    "missing" read as "check the shelf" instead of as a fact about the
    kitchen.
  */
  it('admits what the matching cannot do', async () => {
    await renderWithProviders(<KitchenScreen />);

    expect(screen.getByText('HOW THIS IS MATCHED')).toBeTruthy();
    expect(screen.getByText(/will not match/)).toBeTruthy();
  });

  it('confirms the save, so nothing is silently dropped', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<KitchenScreen />);

    await user.type(screen.getByLabelText('Ingredients at home'), 'rice');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('1 item saved.')).toBeTruthy();
  });
});
