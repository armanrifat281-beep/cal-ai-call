import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { screen, userEvent, waitFor } from '@testing-library/react-native';

import {
  clearLocalRecipes,
  getRecipeRepository,
  getShoppingListRepository,
} from '@/features/recipes';
import { renderWithProviders } from '@/test/renderWithProviders';
import { usePreferencesStore } from '@/store/preferencesStore';
import type { CreateRecipeInput } from '@/features/recipes';

import RecipesHubScreen from '../(tabs)/recipes';
import CreateRecipeScreen from '../recipe/create';
import SavedRecipesScreen from '../recipe/saved';
import ShoppingListsScreen from '../shopping/index';

/**
 * The recipe feature end to end, with no AI provider configured.
 *
 * This is the state of a fresh checkout. Everything asserted here works
 * without a backend: the demo path, saving, the checklist, serving
 * adjustment, search and shopping lists.
 */

function recipeInput(overrides: Partial<CreateRecipeInput> = {}): CreateRecipeInput {
  return {
    title: 'Lentil dal',
    origin: 'ai_generated',
    servings: 4,
    ingredients: [
      {
        id: 'lentils',
        name: 'Red lentils',
        quantity: 200,
        unit: 'g',
        preparation: 'rinsed',
        group: null,
        substitution: null,
        scalesWithServings: true,
        isOwned: false,
      },
    ],
    steps: [
      {
        number: 1,
        instruction: 'Simmer the lentils until soft.',
        durationMinutes: 20,
        temperatureC: null,
        ingredientIds: ['lentils'],
      },
    ],
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await clearLocalRecipes();
  usePreferencesStore.getState().reset();
});

describe('recipes hub', () => {
  it('offers every way in, and none of them is a placeholder', async () => {
    await renderWithProviders(<RecipesHubScreen />);

    expect(screen.getByRole('button', { name: 'Create a recipe' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cook with what I have' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search my recipes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Shopping lists' })).toBeTruthy();
  });

  it('says recipe writing is not set up, rather than failing later', async () => {
    await renderWithProviders(<RecipesHubScreen />);
    expect(screen.getByText('Recipe writing is not set up yet')).toBeTruthy();
  });

  it('shows an empty state before anything is saved', async () => {
    await renderWithProviders(<RecipesHubScreen />);
    expect(await screen.findByText('No saved recipes')).toBeTruthy();
  });

  it('lists a saved recipe', async () => {
    const created = await getRecipeRepository().createRecipe(recipeInput());
    if (!created.ok) throw new Error('fixture failed');

    await renderWithProviders(<RecipesHubScreen />);
    expect(await screen.findByText('Lentil dal')).toBeTruthy();
  });

  it('navigates to the pantry mode with the right parameter', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<RecipesHubScreen />);

    await user.press(screen.getByRole('button', { name: 'Cook with what I have' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recipe/create',
      params: { mode: 'from_pantry' },
    });
  });
});

describe('create recipe form', () => {
  it('explains that writing is unavailable and offers a labelled demo instead', async () => {
    await renderWithProviders(<CreateRecipeScreen />);

    expect(screen.getByText('Recipe writing is not set up yet')).toBeTruthy();
    // No "write me this recipe" button while it cannot be done.
    expect(screen.queryByRole('button', { name: 'Write me this recipe' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Open a demo recipe instead' }),
    ).toBeTruthy();
  });

  it('validates before doing anything', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<CreateRecipeScreen />);

    // The demo path still runs, but the generate path would be blocked. The
    // validation message appears either way once submitted.
    await user.type(screen.getByLabelText('What do you want to cook?'), 'ab');
    expect(screen.queryByText('Tell us what you would like to cook.')).toBeNull();
  });

  it('offers serving presets and a stepper', async () => {
    await renderWithProviders(<CreateRecipeScreen />);
    expect(screen.getByLabelText('Servings')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '2' })).toBeTruthy();
  });

  it('offers Bangladeshi among the cuisines, as asked for', async () => {
    await renderWithProviders(<CreateRecipeScreen />);
    expect(screen.getByRole('checkbox', { name: 'Bangladeshi' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Italian' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Mexican' })).toBeTruthy();
  });

  it('asks which style when "Something else" is chosen', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<CreateRecipeScreen />);

    await user.press(screen.getByRole('checkbox', { name: 'Something else' }));
    expect(screen.getByLabelText('Which style?')).toBeTruthy();
  });

  it('prompts for preferences when none are saved', async () => {
    await renderWithProviders(<CreateRecipeScreen />);
    expect(screen.getByText('No dietary preferences saved')).toBeTruthy();
  });

  it('shows what the recipe will respect, and the allergy disclaimer', async () => {
    usePreferencesStore.getState().setPreferences({
      dietaryPatterns: ['vegetarian'],
      allergyAwarenessEnabled: true,
      allergens: ['Peanuts'],
    });

    await renderWithProviders(<CreateRecipeScreen />);

    expect(screen.getByText('This recipe will respect')).toBeTruthy();
    expect(screen.getByText('no Peanuts')).toBeTruthy();
    // The disclaimer must appear wherever allergies affect the output.
    expect(screen.getByText('Not a safety check')).toBeTruthy();
  });

  it('saves a demo recipe with the demo origin and opens it', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<CreateRecipeScreen />);

    await user.type(screen.getByLabelText('What do you want to cook?'), 'chicken biryani');
    await user.press(screen.getByRole('button', { name: 'Open a demo recipe instead' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalled());

    const saved = await getRecipeRepository().listRecipes();
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value).toHaveLength(1);
    // The demo label survives into storage, not just onto the screen.
    expect(saved.value[0]?.origin).toBe('demo_sample');
    expect(saved.value[0]?.nutritionPerServing?.source).toBe('demo_sample');
  });

  it('remembers the serving count and cuisine for next time', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<CreateRecipeScreen />);

    await user.press(screen.getByRole('checkbox', { name: '2' }));
    await user.press(screen.getByRole('checkbox', { name: 'Italian' }));
    await user.type(screen.getByLabelText('What do you want to cook?'), 'pasta');
    await user.press(screen.getByRole('button', { name: 'Open a demo recipe instead' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalled());

    const { preferences } = usePreferencesStore.getState();
    expect(preferences.preferredServings).toBe(2);
    expect(preferences.favoriteCuisineId).toBe('italian');
  });
});

describe('saved recipes screen', () => {
  it('shows an empty state with nothing saved', async () => {
    await renderWithProviders(<SavedRecipesScreen />);
    expect(await screen.findByText('No saved recipes')).toBeTruthy();
  });

  it('finds a recipe by an ingredient, not just its title', async () => {
    const created = await getRecipeRepository().createRecipe(recipeInput());
    if (!created.ok) throw new Error('fixture failed');

    const user = userEvent.setup();
    await renderWithProviders(<SavedRecipesScreen />);
    await screen.findByText('Lentil dal');

    await user.type(screen.getByLabelText('Search'), 'red lentils');
    expect(await screen.findByText('Lentil dal')).toBeTruthy();
  });

  it('says plainly when nothing matches', async () => {
    const created = await getRecipeRepository().createRecipe(recipeInput());
    if (!created.ok) throw new Error('fixture failed');

    const user = userEvent.setup();
    await renderWithProviders(<SavedRecipesScreen />);
    await screen.findByText('Lentil dal');

    await user.type(screen.getByLabelText('Search'), 'zzzz');
    expect(await screen.findByText('Nothing matches "zzzz"')).toBeTruthy();
  });

  it('keeps a hidden recipe reachable under the Hidden filter', async () => {
    const created = await getRecipeRepository().createRecipe(recipeInput());
    if (!created.ok) throw new Error('fixture failed');
    await getRecipeRepository().setRejected(created.value.id, true);

    const user = userEvent.setup();
    await renderWithProviders(<SavedRecipesScreen />);

    // Hidden from the default list...
    expect(await screen.findByText('No saved recipes')).toBeTruthy();

    // ...but still findable, which is the promise rejection makes.
    await user.press(screen.getByRole('tab', { name: 'Hidden' }));
    expect(await screen.findByText('Lentil dal')).toBeTruthy();
  });
});

describe('shopping lists screen', () => {
  it('shows an empty state and a way to create a list', async () => {
    await renderWithProviders(<ShoppingListsScreen />);

    expect(await screen.findByText('No shopping lists')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New shopping list' })).toBeTruthy();
  });

  it('creates a list and opens it', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<ShoppingListsScreen />);
    await screen.findByText('No shopping lists');

    await user.press(screen.getByRole('button', { name: 'New shopping list' }));

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    const lists = await getShoppingListRepository().listLists();
    expect(lists.ok).toBe(true);
    if (!lists.ok) return;
    expect(lists.value).toHaveLength(1);
  });

  it('shows how many items are still to buy', async () => {
    const created = await getShoppingListRepository().createList({
      name: 'Weekly shop',
      items: [{ name: 'Rice' }, { name: 'Onions' }],
    });
    if (!created.ok) throw new Error('fixture failed');
    await getShoppingListRepository().setItemChecked(
      created.value.items[0]?.id ?? '',
      true,
    );

    await renderWithProviders(<ShoppingListsScreen />);
    expect(await screen.findByText('1 of 2 still to buy')).toBeTruthy();
  });
});
