import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { setRecipeRepositories } from '@/features/recipes';
import type { RecipeRepository } from '@/features/recipes';
import { usePreferencesStore } from '@/store/preferencesStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { palettes } from '@/theme';
import type { Recipe, RecipeIngredient } from '@/types/recipe';

import DiscoverScreen from '../(tabs)/discover';
import MealsScreen from '../(tabs)/meals';

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

function recipe(title: string, ingredients: string[], overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: title,
    userId: 'u1',
    title,
    description: null,
    cuisine: 'italian',
    cuisineNote: null,
    origin: 'ai_generated',
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 20,
    equipment: [],
    ingredients: ingredients.map(ingredient),
    steps: [],
    isFavorite: false,
    image: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  } as Recipe;
}

function useRecipeList(recipes: Recipe[]): void {
  setRecipeRepositories({
    recipes: {
      kind: 'local',
      listRecipes: async () => ({ ok: true as const, value: recipes }),
    } as unknown as RecipeRepository,
    shoppingLists: {} as never,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  usePreferencesStore.getState().reset();
});

afterEach(() => {
  setRecipeRepositories({ recipes: null, shoppingLists: null } as never);
});

/**
 * Discover, built only from what this app actually holds.
 *
 * There is no recipe service behind FoodLens, so nothing here may be
 * fetched, trending or recommended by a model. Everything shown is the
 * user's own saved recipes, ranked against their own kitchen list - and
 * when there is nothing, the screen says so rather than borrowing content.
 */
describe('the discover screen', () => {
  it('says plainly when there is nothing saved yet', async () => {
    useRecipeList([]);

    await renderWithProviders(<DiscoverScreen />);

    await waitFor(() => {
      expect(screen.getByText('No recipes yet')).toBeTruthy();
    });
  });

  it('lists the recipes the user actually has', async () => {
    useRecipeList([recipe('Tomato pasta', ['pasta', 'tomatoes'])]);

    await renderWithProviders(<DiscoverScreen />);

    await waitFor(() => {
      expect(screen.getByText('Tomato pasta')).toBeTruthy();
    });
  });

  it('opens the recipe it was asked to open', async () => {
    useRecipeList([recipe('Tomato pasta', ['pasta', 'tomatoes'])]);

    await renderWithProviders(<DiscoverScreen />);
    fireEvent.press(await screen.findByText('Tomato pasta'));

    expect(router.push).toHaveBeenCalledWith('/recipe/Tomato pasta');
  });

  /*
    Ranking by pantry match is the one genuinely useful ordering this app
    can compute without inventing anything.
  */
  it('ranks by how close each recipe is to cookable', async () => {
    usePreferencesStore.getState().setPantryItems(['pasta', 'tomatoes']);
    useRecipeList([
      recipe('Needs shopping', ['pasta', 'saffron', 'cream']),
      recipe('Ready now', ['pasta', 'tomatoes']),
    ]);

    await renderWithProviders(<DiscoverScreen />);

    await waitFor(() => {
      expect(screen.getByText('Closest to cookable')).toBeTruthy();
    });
    expect(screen.getByText('You have it all')).toBeTruthy();
    expect(screen.getByText('2 to buy')).toBeTruthy();
  });

  it('hides the ranking when there is no kitchen list to rank against', async () => {
    useRecipeList([recipe('Tomato pasta', ['pasta', 'tomatoes'])]);

    await renderWithProviders(<DiscoverScreen />);

    await waitFor(() => {
      expect(screen.getByText('Tomato pasta')).toBeTruthy();
    });
    expect(screen.queryByText('Closest to cookable')).toBeNull();
    // ...and says why, rather than ranking by nothing and calling it a
    // recommendation.
    expect(
      screen.getByText('Add a kitchen list to have these ranked by what you have'),
    ).toBeTruthy();
  });

  it('sends a cuisine choice to the creator, so the tap produces something', async () => {
    useRecipeList([]);

    await renderWithProviders(<DiscoverScreen />);
    fireEvent.press(await screen.findByText('Thai'));

    expect(router.push).toHaveBeenCalledWith('/recipe/create?cuisine=thai');
  });

});

/**
 * The journal is off the tab bar at the user's request, not deleted.
 *
 * Home is fixed to `todayKey()`, so the journal is the only screen that can
 * reach a day other than today - and therefore the only way to edit or
 * delete a meal logged yesterday. Losing the route to it would lose that,
 * silently, while every test about logging still passed.
 */
describe('after the journal left the tab bar', () => {
  /*
    The Meals tab reaches yesterday and tomorrow and no further, so without
    a door here the journal - the only screen that can open last week, and
    the only one that can edit a meal saved in it - would be reachable from
    nowhere at all.
  */
  it('the Meals tab still offers a way into it', async () => {
    await renderWithProviders(<MealsScreen />);

    fireEvent.press(await screen.findByText('History'));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/journal');
  });
});

/**
 * Discover and the recipe it opens are the app's pale half.
 *
 * The app opens dark and stays dark everywhere else; these two are mint and
 * green because they are about food nobody has cooked yet, photographed.
 * That is held by `SchemeOverride`, which is invisible on screen and easy to
 * drop while editing something else - so it is checked here rather than
 * noticed later by a user whose recipe screen went black.
 */
function hasBackground(color: string): boolean {
  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false;
    if (Array.isArray(node)) return node.some(walk);
    const element = node as { props?: Record<string, unknown>; children?: unknown };
    const style = element.props?.style;
    const flat = Array.isArray(style)
      ? Object.assign({}, ...style.filter(Boolean))
      : ((style as Record<string, unknown> | undefined) ?? {});
    if (flat.backgroundColor === color) return true;
    return walk(element.children);
  };
  return walk(screen.toJSON());
}

describe('the pale half of the app', () => {
  it('draws Discover on paper even though the app itself is dark', async () => {
    useRecipeList([recipe('Tomato pasta', ['pasta'])]);
    await renderWithProviders(<DiscoverScreen />);

    await waitFor(() => expect(screen.getByText('Browse by type')).toBeTruthy());
    expect(hasBackground(palettes.light.background)).toBe(true);
    expect(hasBackground(palettes.dark.background)).toBe(false);
  });

  /*
    The bar belongs to the navigator, not to the screen, so it stays in the
    user's own scheme. One screen repainting the furniture around it would
    make every tab change flash.
  */
  it('leaves the dark screens dark', async () => {
    await renderWithProviders(<MealsScreen />);

    await waitFor(() => expect(screen.getByText('Breakfast')).toBeTruthy());
    expect(hasBackground(palettes.dark.background)).toBe(true);
    expect(hasBackground(palettes.light.background)).toBe(false);
  });
});
