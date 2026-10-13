import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';

import { clearLocalRecipes, getDeviceRecipeRepository } from '@/features/recipes';
import { usePreferencesStore } from '@/store/preferencesStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { CreateRecipeInput } from '@/features/recipes';

import RecipesScreen from '../(tabs)/recipes';

function recipe(
  title: string,
  overrides: Partial<CreateRecipeInput> = {},
): CreateRecipeInput {
  return {
    title,
    description: null,
    cuisine: 'italian',
    cuisineNote: null,
    origin: 'ai_generated',
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 50,
    equipment: [],
    ingredients: [
      {
        id: `${title}-1`,
        name: 'Rice',
        quantity: 1,
        unit: 'cup',
        preparation: null,
        group: null,
        substitution: null,
        scalesWithServings: true,
      },
    ],
    steps: [{ id: `${title}-s1`, order: 1, instruction: 'Cook it.', minutes: null }],
    ...overrides,
  } as CreateRecipeInput;
}

beforeEach(async () => {
  jest.clearAllMocks();
  // The device repository persists between tests, so one test's fixtures
  // would otherwise show up in the next one's assertions.
  await AsyncStorage.clear();
  await clearLocalRecipes();
  usePreferencesStore.getState().reset();
});

/**
 * The controls have to change what is on screen.
 *
 * A search box and a row of filter chips that leave the list exactly as it
 * was are worse than none: they look like the screen is broken rather than
 * like the feature is missing. These press the real controls against real
 * saved recipes.
 */
describe('searching and filtering the recipe library', () => {
  it('narrows the list to what matches the words typed', async () => {
    const repository = getDeviceRecipeRepository();
    await repository.createRecipe(recipe('Lentil dal'));
    await repository.createRecipe(recipe('Tomato pasta'));

    await renderWithProviders(<RecipesScreen />);
    await screen.findByText('Lentil dal');

    fireEvent.changeText(screen.getByLabelText('Search your recipes'), 'pasta');

    await waitFor(() => {
      expect(screen.queryByText('Lentil dal')).toBeNull();
    });
    expect(screen.getByText('Tomato pasta')).toBeTruthy();
  });

  it('searches the ingredients too, not only the name', async () => {
    const repository = getDeviceRecipeRepository();
    await repository.createRecipe(
      recipe('Mystery bowl', {
        ingredients: [
          {
            id: 'i1',
            name: 'Aubergine',
            quantity: 1,
            unit: 'piece',
            preparation: null,
            group: null,
            substitution: null,
            scalesWithServings: true,
          },
        ],
      } as Partial<CreateRecipeInput>),
    );

    await renderWithProviders(<RecipesScreen />);
    await screen.findByText('Mystery bowl');

    fireEvent.changeText(screen.getByLabelText('Search your recipes'), 'aubergine');

    await waitFor(() => {
      expect(screen.getByText('Mystery bowl')).toBeTruthy();
    });
  });

  it('says so plainly when nothing matches', async () => {
    await getDeviceRecipeRepository().createRecipe(recipe('Lentil dal'));

    await renderWithProviders(<RecipesScreen />);
    await screen.findByText('Lentil dal');

    fireEvent.changeText(screen.getByLabelText('Search your recipes'), 'zzzz');

    expect(await screen.findByText('Nothing matches')).toBeTruthy();
  });

  /*
    A chip that returns nothing is a dead end, so the quick filter is only
    drawn when a recipe actually qualifies.
  */
  it('offers the quick filter only when something is quick', async () => {
    await getDeviceRecipeRepository().createRecipe(
      recipe('Slow stew', { prepMinutes: 30, cookMinutes: 180 }),
    );

    await renderWithProviders(<RecipesScreen />);
    await screen.findByText('Slow stew');

    expect(screen.queryByText('Under 30 min')).toBeNull();
  });

  it('filters to the quick ones when it is offered', async () => {
    const user = userEvent.setup();
    const repository = getDeviceRecipeRepository();
    await repository.createRecipe(recipe('Slow stew', { prepMinutes: 30, cookMinutes: 180 }));
    await repository.createRecipe(recipe('Fast eggs', { prepMinutes: 5, cookMinutes: 10 }));

    await renderWithProviders(<RecipesScreen />);
    await screen.findAllByText('Fast eggs');

    await user.press(screen.getByText('Under 30 min'));

    await waitFor(() => {
      expect(screen.queryByText('Slow stew')).toBeNull();
    });
    // A recipe can legitimately appear in more than one section.
    expect(screen.getAllByText('Fast eggs').length).toBeGreaterThan(0);
  });

  it('brings everything back when the filters are cleared', async () => {
    const user = userEvent.setup();
    const repository = getDeviceRecipeRepository();
    await repository.createRecipe(recipe('Slow stew', { prepMinutes: 30, cookMinutes: 180 }));
    await repository.createRecipe(recipe('Fast eggs', { prepMinutes: 5, cookMinutes: 10 }));

    await renderWithProviders(<RecipesScreen />);
    await screen.findAllByText('Fast eggs');

    await user.press(screen.getByText('Under 30 min'));
    await waitFor(() => {
      expect(screen.queryByText('Slow stew')).toBeNull();
    });

    await user.press(screen.getByText('Clear'));

    await waitFor(() => {
      expect(screen.getByText('Slow stew')).toBeTruthy();
    });
  });

  /*
    The populated layout. With a library worth browsing the screen leads
    with a card and groups the rest; with fewer than three it skips the card
    rather than repeating the same dish three times.
  */
  it('leads with a featured card once there is a library', async () => {
    const repository = getDeviceRecipeRepository();
    await repository.createRecipe(recipe('Lentil dal'));
    await repository.createRecipe(recipe('Tomato pasta'));
    await repository.createRecipe(recipe('Fish curry'));

    await renderWithProviders(<RecipesScreen />);

    expect(await screen.findByText('Latest')).toBeTruthy();
    expect(screen.getByText('All recipes')).toBeTruthy();
  });

  it('skips the featured card when there is barely a library', async () => {
    await getDeviceRecipeRepository().createRecipe(recipe('Lentil dal'));

    await renderWithProviders(<RecipesScreen />);

    expect(await screen.findByText('All recipes')).toBeTruthy();
    expect(screen.queryByText('Latest')).toBeNull();
  });

  it('groups favourites separately when any are marked', async () => {
    const repository = getDeviceRecipeRepository();
    const created = await repository.createRecipe(recipe('Lentil dal'));
    if (!created.ok) throw new Error('fixture failed');
    await repository.setFavorite(created.value.id, true);

    await renderWithProviders(<RecipesScreen />);

    // Twice over: the filter chip, and the section it groups them into.
    expect(await screen.findAllByText('Favourites')).toHaveLength(2);
  });
});
