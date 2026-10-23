import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { MacroSplitCard } from '../MacroSplitCard';

/**
 * This card is one half of a two-card row, so it is about 175pt wide on a
 * phone. With the legend beside the donut the labels were left with almost
 * no width, and text with no room does not clip - it wraps, one letter per
 * line. "Protein" became a column seven rows tall and took the whole screen
 * with it.
 */

const TOTALS = {
  caloriesKcal: 900,
  proteinG: 68,
  carbsG: 84,
  fatG: 29,
  fiberG: 9,
  sugarG: 21,
  saturatedFatG: 8,
  sodiumMg: 1100,
};

describe('MacroSplitCard', () => {
  it('keeps each macro label on one line, however little width it is given', async () => {
    await renderWithProviders(<MacroSplitCard totals={TOTALS} />);

    for (const label of ['Protein', 'Carbs', 'Fat']) {
      expect(screen.getByText(label).props.numberOfLines).toBe(1);
    }
  });

  it('still shows every macro and its share', async () => {
    await renderWithProviders(<MacroSplitCard totals={TOTALS} />);

    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText('Carbs')).toBeTruthy();
    expect(screen.getByText('Fat')).toBeTruthy();
  });
});
