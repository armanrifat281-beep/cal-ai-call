import { renderWithProviders } from '@/test/renderWithProviders';

import InsightsScreen from '@/../app/(tabs)/insights';
import JournalScreen from '@/../app/(tabs)/journal';
import ProfileScreen from '@/../app/(tabs)/profile';
import RecipesScreen from '@/../app/(tabs)/recipes';
import FoodSearchScreen from '@/../app/foods/search';
import PortionScreen from '@/../app/foods/portion';
import ShoppingScreen from '@/../app/shopping/index';
import SavedRecipesScreen from '@/../app/recipe/saved';
import CreateRecipeScreen from '@/../app/recipe/create';
import HelpScreen from '@/../app/settings/help';
import PrivacyScreen from '@/../app/settings/privacy';
import TermsScreen from '@/../app/settings/terms';

/**
 * Every screen, rendered once.
 *
 * Not a behaviour test: it asks only whether a screen can be shown at all
 * with the app in its default, empty state. A crash on open is the one
 * failure a user cannot work around, and it is exactly what the existing
 * suite does not cover for these screens.
 */
const SCREENS: [string, React.ComponentType][] = [
  ['Journal', JournalScreen],
  ['Insights', InsightsScreen],
  ['Recipes', RecipesScreen],
  ['Profile', ProfileScreen],
  ['Food search', FoodSearchScreen],
  ['Portion', PortionScreen],
  ['Shopping lists', ShoppingScreen],
  ['Saved recipes', SavedRecipesScreen],
  ['Create recipe', CreateRecipeScreen],
  ['Help', HelpScreen],
  ['Privacy', PrivacyScreen],
  ['Terms', TermsScreen],
];

describe('every screen opens', () => {
  it.each(SCREENS)('%s', async (_name, Component) => {
    const view = await renderWithProviders(<Component />);
    expect(view.toJSON()).not.toBeNull();
  });
});
