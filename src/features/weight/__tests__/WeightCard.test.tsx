import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';
import { usePreferencesStore } from '@/store/preferencesStore';

import { setWeightRepository } from '../hooks';
import type { WeightEntry, WeightRepository } from '../repository';
import { WeightCard } from '../WeightCard';

function fakeRepository(rows: WeightEntry[] = []): WeightRepository & {
  rows: WeightEntry[];
} {
  const store = [...rows];
  return {
    rows: store,
    kind: 'local',
    list: async () => ({ ok: true as const, value: [...store] }),
    add: async (weightKg: number) => {
      const entry = {
        id: `w${store.length}`,
        measuredAt: new Date().toISOString(),
        weightKg,
      };
      store.unshift(entry);
      return { ok: true as const, value: entry };
    },
    remove: async () => ({ ok: true as const, value: undefined }),
  };
}

function reading(weightKg: number, daysAgo: number): WeightEntry {
  return {
    id: `r${daysAgo}`,
    measuredAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    weightKg,
  };
}

afterEach(() => {
  setWeightRepository(null);
  usePreferencesStore.getState().setMeasurementSystem('metric');
});

describe('WeightCard', () => {
  it('asks for a first reading when there is none', async () => {
    setWeightRepository(fakeRepository());
    await renderWithProviders(<WeightCard />);

    expect(await screen.findByLabelText('Weight in kg')).toBeTruthy();
  });

  it('saves what was typed', async () => {
    const repo = fakeRepository();
    setWeightRepository(repo);
    const user = userEvent.setup();
    await renderWithProviders(<WeightCard />);

    await user.type(await screen.findByLabelText('Weight in kg'), '74.5');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(repo.rows[0]?.weightKg).toBe(74.5);
  });

  describe('the trend', () => {
    /*
      One weigh-in is a number, not a direction, and a direction is the only
      thing worth showing. Implying one from a single reading would be an
      invented claim about the user's body.
    */
    it('shows no direction from a single reading', async () => {
      setWeightRepository(fakeRepository([reading(74, 0)]));
      await renderWithProviders(<WeightCard />);

      expect(await screen.findByText('Weigh in again to see a trend')).toBeTruthy();
    });

    it('reports the change and the days it covers', async () => {
      setWeightRepository(fakeRepository([reading(74, 0), reading(76, 28)]));
      await renderWithProviders(<WeightCard />);

      expect(await screen.findByText('2.0 kg in 28 days')).toBeTruthy();
    });

    // The window is 30 days: an old reading must not be compared against.
    it('ignores a reading older than the window', async () => {
      setWeightRepository(fakeRepository([reading(74, 0), reading(90, 200)]));
      await renderWithProviders(<WeightCard />);

      expect(await screen.findByText('Weigh in again to see a trend')).toBeTruthy();
    });
  });

  describe('in pounds', () => {
    it('shows the reading and the change converted', async () => {
      usePreferencesStore.getState().setMeasurementSystem('imperial');
      setWeightRepository(fakeRepository([reading(74, 0), reading(76, 28)]));
      await renderWithProviders(<WeightCard />);

      // 74 kg is 163.1 lb; a 2 kg change is 4.4 lb.
      expect(await screen.findByText('163.1')).toBeTruthy();
      expect(screen.getByText('4.4 lb in 28 days')).toBeTruthy();
    });

    it('stores kilograms whatever the user types in', async () => {
      usePreferencesStore.getState().setMeasurementSystem('imperial');
      const repo = fakeRepository();
      setWeightRepository(repo);
      const user = userEvent.setup();
      await renderWithProviders(<WeightCard />);

      await user.type(await screen.findByLabelText('Weight in lb'), '165');
      await user.press(screen.getByRole('button', { name: 'Save' }));

      // Stored in kg, so two devices on different settings agree.
      expect(repo.rows[0]?.weightKg).toBeCloseTo(74.84, 1);
    });
  });

  it('refuses a number outside what a person can weigh', async () => {
    setWeightRepository(fakeRepository());
    const user = userEvent.setup();
    await renderWithProviders(<WeightCard />);

    await user.type(await screen.findByLabelText('Weight in kg'), '745');

    expect(screen.getByText(/Enter a weight between/)).toBeTruthy();
  });
});
