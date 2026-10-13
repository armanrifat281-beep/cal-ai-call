import { screen, waitFor } from '@testing-library/react-native';

import { lookupBarcode } from '@/features/labels';
import { ok } from '@/lib/result';
import { usePreferencesStore } from '@/store/preferencesStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { LabelLookup } from '@/features/labels';

import ProductScreen from '../label/[barcode]';

jest.mock('@/features/labels', () => {
  const actual = jest.requireActual('@/features/labels');
  return { ...actual, lookupBarcode: jest.fn() };
});

const mockedLookup = lookupBarcode as jest.MockedFunction<typeof lookupBarcode>;

const routerMock = jest.requireMock('expo-router') as {
  __setSearchParams: (next: Record<string, string>) => void;
};

function lookup(overrides: Partial<LabelLookup['product']> = {}, gaps: Partial<LabelLookup['gaps']> = {}): LabelLookup {
  return {
    product: {
      barcode: '3017620422003',
      name: 'Hazelnut spread',
      brand: 'Someone',
      servingSize: null,
      servingGrams: null,
      per100g: {
        caloriesKcal: 539,
        proteinG: 6.3,
        carbsG: 57.5,
        fatG: 30.9,
        fiberG: null,
        sugarG: 56.3,
        saturatedFatG: 10.6,
        sodiumMg: 42.8,
      },
      ingredients: ['Sugar', 'palm oil', 'hazelnuts'],
      declaredAllergens: ['milk', 'nuts'],
      source: 'open_food_facts',
      updatedAt: null,
      ...overrides,
    },
    gaps: {
      missingNutrition: false,
      missingIngredients: false,
      missingAllergens: false,
      missingNutrients: ['fiberG'],
      ...gaps,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  usePreferencesStore.getState().reset();
  routerMock.__setSearchParams({ barcode: '3017620422003' });
});

/**
 * A label is a primary source: what it does not say, nobody knows.
 *
 * These guard the quiet failure - a blank figure rendered as a number, or an
 * allergen inferred from an ingredient list - which still looks like a fact
 * to the person reading it.
 */
describe('the product screen', () => {
  it('shows the figures the record holds', async () => {
    mockedLookup.mockResolvedValue(ok(lookup()));

    await renderWithProviders(<ProductScreen />);

    await waitFor(() => {
      expect(screen.getByText('539 kcal')).toBeTruthy();
    });
    expect(screen.getByText('6.3 g')).toBeTruthy();
  });

  /*
    The four core figures cannot be null in `Nutrients`, so an absent one
    arrives as 0. Printed as "0 g" it is indistinguishable from a real zero.
  */
  it('prints a missing figure as "not stated", never as zero', async () => {
    mockedLookup.mockResolvedValue(ok(lookup()));

    await renderWithProviders(<ProductScreen />);

    await waitFor(() => {
      expect(screen.getByText('not stated')).toBeTruthy();
    });
    // Fibre is the gap in this fixture, and it must not read as 0 g.
    expect(screen.queryByText('0 g')).toBeNull();
  });

  it('says a missing allergen statement is not the same as having none', async () => {
    mockedLookup.mockResolvedValue(
      ok(lookup({ declaredAllergens: [] }, { missingAllergens: true })),
    );

    await renderWithProviders(<ProductScreen />);

    await waitFor(() => {
      expect(screen.getByText('No allergen statement in this record')).toBeTruthy();
    });
  });

  it('warns when the packet declares something the user avoids', async () => {
    usePreferencesStore.getState().setAllergens(['milk']);
    mockedLookup.mockResolvedValue(ok(lookup()));

    await renderWithProviders(<ProductScreen />);

    await waitFor(() => {
      expect(screen.getByText('THIS PACKET DECLARES MILK')).toBeTruthy();
    });
  });

  /*
    The warning reads the packet's own declaration only. Scanning the
    ingredient text for an allergen and being wrong is the failure that
    actually hurts somebody.
  */
  it('does not warn from the ingredient list alone', async () => {
    usePreferencesStore.getState().setAllergens(['palm oil']);
    mockedLookup.mockResolvedValue(ok(lookup()));

    await renderWithProviders(<ProductScreen />);

    await waitFor(() => {
      expect(screen.getByText('539 kcal')).toBeTruthy();
    });
    expect(screen.queryByText(/THIS PACKET DECLARES/)).toBeNull();
  });

  it('names where the figures came from', async () => {
    mockedLookup.mockResolvedValue(ok(lookup()));

    await renderWithProviders(<ProductScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Open Food Facts/)).toBeTruthy();
    });
  });
});
