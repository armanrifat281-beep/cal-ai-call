import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import CreateRecipeScreen from '../recipe/create';

const routerMock = jest.requireMock('expo-router') as {
  __setSearchParams: (next: Record<string, string>) => void;
};

/**
 * Taking an analysed meal to the recipe creator.
 *
 * The scanner can name what is on a plate; the obvious next thing to want is
 * something to cook with those ingredients. That hand-over is a route
 * parameter, which is exactly the kind of wiring that breaks silently - the
 * screen still opens, just empty, and nothing says the foods were dropped.
 */
describe('the recipe creator, opened from an analysed meal', () => {
  beforeEach(() => {
    routerMock.__setSearchParams({});
  });

  it('starts from the foods it was handed', async () => {
    routerMock.__setSearchParams({ pantry: 'Rice, Grilled chicken' });

    await renderWithProviders(<CreateRecipeScreen />);

    expect(screen.getByDisplayValue('Rice, Grilled chicken')).toBeTruthy();
  });

  it('switches to the pantry mode, so the foods are actually used', async () => {
    routerMock.__setSearchParams({ pantry: 'Rice' });

    await renderWithProviders(<CreateRecipeScreen />);

    // The mode selector marks the chosen mode as selected.
    expect(
      screen.getByRole('tab', { name: 'What I have', selected: true }),
    ).toBeTruthy();
  });

  it('opens on its normal mode when nothing was handed over', async () => {
    await renderWithProviders(<CreateRecipeScreen />);

    expect(screen.queryByDisplayValue('Rice')).toBeNull();
  });
});
