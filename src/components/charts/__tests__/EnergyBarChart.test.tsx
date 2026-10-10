import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { EnergyBarChart } from '../EnergyBarChart';
import type { EnergyBarDay } from '../EnergyBars';

function days(values: (number | null)[]): EnergyBarDay[] {
  return values.map((value, index) => ({
    dateKey: `2026-10-${String(index + 1).padStart(2, '0')}`,
    caloriesKcal: value ?? 0,
    hasData: value !== null,
  }));
}

describe('EnergyBarChart', () => {
  it('renders nothing for an empty period', async () => {
    await renderWithProviders(<EnergyBarChart days={[]} targetKcal={2000} />);
    expect(screen.queryByText(/days logged/)).toBeNull();
  });

  it('says how many days actually have meals in them', async () => {
    await renderWithProviders(
      <EnergyBarChart days={days([1800, null, 2100, null, 1950])} targetKcal={2000} />,
    );
    expect(screen.getByText('3 of 5 days logged')).toBeTruthy();
  });

  it('averages the logged days and says so', async () => {
    await renderWithProviders(
      <EnergyBarChart days={days([2000, null, 2000, null])} targetKcal={null} />,
    );
    // Not 1000, which is what averaging across the blank days would give.
    expect(screen.getByText('2000 kcal average on those days')).toBeTruthy();
  });

  it('offers no average when the period is entirely empty', async () => {
    await renderWithProviders(
      <EnergyBarChart days={days([null, null, null])} targetKcal={2000} />,
    );
    expect(screen.getByText('0 of 3 days logged')).toBeTruthy();
    expect(screen.queryByText(/average/)).toBeNull();
  });

  it('describes the period to a screen reader', async () => {
    await renderWithProviders(
      <EnergyBarChart days={days([1800, 2100, null])} targetKcal={2000} />,
    );
    expect(
      screen.getByLabelText(
        /Daily energy over 3 days\. 2 days have meals logged, averaging 1950 kilocalories\. The target is 2000\./,
      ),
    ).toBeTruthy();
  });

  it('tells a screen reader when nothing was logged, rather than reading zeroes', async () => {
    await renderWithProviders(
      <EnergyBarChart days={days([null, null])} targetKcal={2000} />,
    );
    expect(
      screen.getByLabelText('No days with anything logged in this period.'),
    ).toBeTruthy();
  });

  it('labels enough days to orient without crowding a month', async () => {
    await renderWithProviders(
      <EnergyBarChart days={days(Array.from({ length: 30 }, () => 1800))} targetKcal={null} />,
    );
    // One label every fifth bar for thirty days, not thirty labels.
    expect(screen.getAllByText(/^\d+$/).length).toBeLessThanOrEqual(8);
  });

  it('labels every day over a short period', async () => {
    await renderWithProviders(
      <EnergyBarChart days={days([1800, 1900, 2000])} targetKcal={null} />,
    );
    expect(screen.getAllByText(/^\d+$/)).toHaveLength(3);
  });
});
