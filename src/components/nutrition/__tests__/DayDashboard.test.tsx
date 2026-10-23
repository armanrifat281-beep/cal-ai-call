import { screen } from '@testing-library/react-native';

import { summarizeEntries } from '@/features/nutrition';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { DailyTargets, FoodEntry } from '@/types/domain';

import { DayDashboard } from '../DayDashboard';

function entryOf(kcal: number, proteinG = 0): FoodEntry {
  return {
    id: 'e1',
    userId: 'u1',
    consumedAt: '2026-10-13T12:00:00.000Z',
    mealType: 'lunch',
    title: 'Lunch',
    items: [
      {
        id: 'i1',
        name: 'Food',
        brand: null,
        portion: { quantity: 100, unit: 'g' },
        gramsResolved: 100,
        nutrients: {
          caloriesKcal: kcal,
          proteinG,
          carbsG: 0,
          fatG: 0,
          fiberG: null,
          sugarG: null,
          saturatedFatG: null,
          sodiumMg: null,
        },
        provenance: {
          source: 'database',
          confidence: 'high',
          providerLabel: null,
          providerRef: null,
        },
        foodRecordId: null,
        notes: null,
      },
    ],
    photoPath: null,
    notes: null,
    createdAt: '2026-10-13T12:00:00.000Z',
    updatedAt: '2026-10-13T12:00:00.000Z',
  };
}

const TARGETS: DailyTargets = {
  caloriesKcal: 2000,
  proteinG: 120,
  carbsG: 250,
  fatG: 70,
};

/**
 * The first screenful of the app.
 *
 * What it says has to be the thing a decision turns on, and it has to stay
 * readable when the day goes past its target or when there is no target at
 * all - the two states a dial is easiest to get wrong in.
 */
describe('the day dashboard', () => {
  it('leads with what is left, which is what dinner turns on', async () => {
    await renderWithProviders(
      <DayDashboard
        summary={summarizeEntries([entryOf(750)])}
        targets={TARGETS}
        dayLabel="Today"
      />,
    );

    // Inside the ring: one place to look for one fact.
    expect(screen.getByText('1250')).toBeTruthy();
    expect(screen.getByText('kcal left')).toBeTruthy();
    // And what was eaten, beside it, as a plain figure.
    expect(screen.getByText('Eaten')).toBeTruthy();
    expect(screen.getByText('750')).toBeTruthy();
  });

  /*
    Past the target the remaining figure goes negative, and "-250 kcal left"
    is not a sentence anyone reads correctly.
  */
  it('says "over" rather than showing a negative number left', async () => {
    await renderWithProviders(
      <DayDashboard
        summary={summarizeEntries([entryOf(2250)])}
        targets={TARGETS}
        dayLabel="Today"
      />,
    );

    expect(screen.getByText('250')).toBeTruthy();
    expect(screen.getByText('kcal over')).toBeTruthy();
  });

  it('shows the plain total when no goal is set, rather than a ring against nothing', async () => {
    await renderWithProviders(
      <DayDashboard
        summary={summarizeEntries([entryOf(600)])}
        targets={{ caloriesKcal: null, proteinG: null, carbsG: null, fatG: null }}
        dayLabel="Today"
      />,
    );

    expect(screen.getByText('kcal eaten today')).toBeTruthy();
    expect(screen.queryByText('kcal left')).toBeNull();
  });

  /*
    Home showed the total and nothing else when no target was set, which
    read as a screen that did not work. The dial now carries the one
    control that fixes it.
  */
  it('offers the way to set a target when there is none', async () => {
    const onSetTarget = jest.fn();
    await renderWithProviders(
      <DayDashboard
        summary={summarizeEntries([entryOf(600)])}
        targets={{ caloriesKcal: null, proteinG: null, carbsG: null, fatG: null }}
        dayLabel="Today"
        onSetTarget={onSetTarget}
      />,
    );

    expect(screen.getByText('Set a daily target')).toBeTruthy();
  });

  it('shows each macro against its target', async () => {
    await renderWithProviders(
      <DayDashboard
        summary={summarizeEntries([entryOf(750, 40)])}
        targets={TARGETS}
        dayLabel="Today"
      />,
    );

    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText('Carbs')).toBeTruthy();
    expect(screen.getByText('Fat')).toBeTruthy();
    // Eaten and target together on the tile, not two figures in two places.
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getByText('/ 120g')).toBeTruthy();
  });

  it('reads an empty day as nothing eaten, not as a missing day', async () => {
    await renderWithProviders(
      <DayDashboard
        summary={summarizeEntries([])}
        targets={TARGETS}
        dayLabel="Today"
      />,
    );

    expect(screen.getByText('2000')).toBeTruthy();
    expect(screen.getByText('kcal left')).toBeTruthy();
  });

  /*
    This app tracks no exercise and talks to no watch, so a burn figure it
    cannot derive is a number it would be making up. Without the user's
    height, weight and age it says so and offers the way to fix it.
  */
  it('does not invent a figure for energy burned', async () => {
    await renderWithProviders(
      <DayDashboard
        summary={summarizeEntries([entryOf(750)])}
        targets={TARGETS}
        dayLabel="Today"
        burnedKcal={null}
      />,
    );

    expect(screen.getByText('Burned')).toBeTruthy();
    expect(screen.getByText('Add your details')).toBeTruthy();
  });

  it('shows the burn once it can be worked out', async () => {
    await renderWithProviders(
      <DayDashboard
        summary={summarizeEntries([entryOf(750)])}
        targets={TARGETS}
        dayLabel="Today"
        burnedKcal={1410}
      />,
    );

    expect(screen.getByText('1,410')).toBeTruthy();
  });
});
