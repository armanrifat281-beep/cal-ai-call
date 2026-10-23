import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import PortionScreen from '../foods/portion';

const routerMock = jest.requireMock('expo-router') as {
  __setSearchParams: (next: Record<string, string>) => void;
};

/** A record as the food search hands it over, per 100 g. */
function record(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'usda-1105314',
    name: 'Bananas, overripe, raw',
    brand: null,
    source: 'usda',
    sourceRef: '1105314',
    nutrientsPer100g: {
      caloriesKcal: 85,
      proteinG: 1,
      carbsG: 20,
      fatG: 0.3,
      fiberG: 2.6,
      sugarG: 12.2,
      saturatedFatG: null,
      sodiumMg: 1,
      ...((overrides.nutrientsPer100g as object | undefined) ?? {}),
    },
    ...overrides,
  });
}

beforeEach(() => {
  routerMock.__setSearchParams({ food: record() });
});

/*
  The finds below carry a longer timeout than the default second.

  This screen parses its record, scales every figure and renders two
  surfaces on mount; under a full parallel test run that occasionally ran
  past one second and failed here while passing alone. A flaky test costs
  more than the second it saves.
*/
const SLOW = { timeout: 5000 };

/**
 * Adding a food from the database.
 *
 * The screen showed four figures and then a screenful of nothing, while the
 * record it was holding also carried fibre, sugar, saturated fat and sodium.
 * These pin that the rest is shown - and, more importantly, that a figure
 * the database does not hold is never printed as a zero.
 */
describe('the add-a-food screen', () => {
  it('shows the four figures the search found', async () => {
    await renderWithProviders(<PortionScreen />);

    expect(await screen.findByText('85', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Bananas, overripe, raw')).toBeTruthy();
  });

  it('shows the nutrients it used to throw away', async () => {
    await renderWithProviders(<PortionScreen />);

    expect((await screen.findAllByText('Fibre', {}, SLOW)).length).toBeGreaterThan(0);
    expect(screen.getByText('Sugar')).toBeTruthy();
    expect(screen.getAllByText('Sodium').length).toBeGreaterThan(0);
    expect(screen.getByText('Saturates')).toBeTruthy();
  });

  /*
    The rule the whole app is built on. A record with no saturated-fat
    figure must not render "0 g", which is indistinguishable from a food
    that genuinely has none.
  */
  it('never prints a missing figure as a zero', async () => {
    await renderWithProviders(<PortionScreen />);

    await screen.findByText('85', {}, SLOW);
    // Saturated fat is absent from this record, so it must say so.
    expect(screen.getByText('not stated')).toBeTruthy();
    expect(screen.queryByText('0g')).toBeNull();
  });

  it('offers a way to take the amount back down', async () => {
    await renderWithProviders(<PortionScreen />);

    // Both directions, side by side with the figure between them. Only
    // being able to go up means a mis-tap can only be fixed by starting
    // again.
    expect(await screen.findByRole('button', { name: 'Less' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });
});
