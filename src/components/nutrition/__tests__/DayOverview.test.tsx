import { screen } from '@testing-library/react-native';

import { summarizeEntries } from '@/features/nutrition';
import { renderWithProviders } from '@/test/renderWithProviders';
import {
  EMPTY_NUTRIENTS,
  type DailyTargets,
  type FoodEntry,
  type MealType,
  type NutrientSource,
} from '@/types/domain';

import { DayOverview } from '../DayOverview';

const NO_TARGETS: DailyTargets = {
  caloriesKcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
};

function entry(
  mealType: MealType,
  caloriesKcal: number,
  macros: { proteinG: number; carbsG: number; fatG: number },
  source: NutrientSource = 'user_entered',
): FoodEntry {
  return {
    id: `${mealType}-1`,
    userId: 'local',
    consumedAt: '2026-10-10T08:00:00.000Z',
    mealType,
    title: `${mealType} meal`,
    photoPath: null,
    notes: null,
    createdAt: '2026-10-10T08:00:00.000Z',
    updatedAt: '2026-10-10T08:00:00.000Z',
    items: [
      {
        id: `${mealType}-item`,
        name: 'Food',
        brand: null,
        portion: { quantity: 100, unit: 'g' },
        gramsResolved: 100,
        nutrients: { ...EMPTY_NUTRIENTS, caloriesKcal, ...macros },
        provenance: {
          source,
          confidence: 'high',
          providerLabel: null,
          providerRef: null,
        },
        foodRecordId: null,
        notes: null,
      },
    ],
  };
}

const DAY = [
  entry('breakfast', 420, { proteinG: 22, carbsG: 48, fatG: 14 }),
  entry('dinner', 680, { proteinG: 38, carbsG: 62, fatG: 26 }),
];

describe('DayOverview', () => {
  it('leads with the day total', async () => {
    await renderWithProviders(
      <DayOverview summary={summarizeEntries(DAY)} targets={NO_TARGETS} dayLabel="Today" />,
    );
    expect(screen.getByText('1100')).toBeTruthy();
  });

  it('lists the macros in grams, which proportions alone cannot give', async () => {
    await renderWithProviders(
      <DayOverview summary={summarizeEntries(DAY)} targets={NO_TARGETS} dayLabel="Today" />,
    );
    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText('60 g')).toBeTruthy();
    expect(screen.getByText('110 g')).toBeTruthy();
    expect(screen.getByText('40 g')).toBeTruthy();
  });

  it('shows one decimal for a small amount rather than rounding it to zero', async () => {
    const tiny = [entry('snack', 20, { proteinG: 0.4, carbsG: 4, fatG: 0.2 })];
    await renderWithProviders(
      <DayOverview summary={summarizeEntries(tiny)} targets={NO_TARGETS} dayLabel="Today" />,
    );
    expect(screen.getByText('0.4 g')).toBeTruthy();
  });

  it('claims no progress when no target is set', async () => {
    await renderWithProviders(
      <DayOverview summary={summarizeEntries(DAY)} targets={NO_TARGETS} dayLabel="Today" />,
    );
    expect(screen.queryByText(/of target/)).toBeNull();
    expect(screen.getByText('kcal today')).toBeTruthy();
  });

  it('states progress against a target when there is one', async () => {
    await renderWithProviders(
      <DayOverview
        summary={summarizeEntries(DAY)}
        targets={{ ...NO_TARGETS, caloriesKcal: 2200 }}
        dayLabel="Today"
      />,
    );
    expect(screen.getByText('of 2200 kcal')).toBeTruthy();
  });

  it('marks going over the target in the heading', async () => {
    await renderWithProviders(
      <DayOverview
        summary={summarizeEntries(DAY)}
        targets={{ ...NO_TARGETS, caloriesKcal: 900 }}
        dayLabel="Today"
      />,
    );
    expect(screen.getByText(/of target/)).toBeTruthy();
  });

  it('shows the protein target beside the protein figure', async () => {
    await renderWithProviders(
      <DayOverview
        summary={summarizeEntries(DAY)}
        targets={{ ...NO_TARGETS, proteinG: 120 }}
        dayLabel="Today"
      />,
    );
    expect(screen.getByText(' / 120 g')).toBeTruthy();
  });

  it('says when part of the total came from a photo estimate', async () => {
    const estimated = [
      entry('lunch', 500, { proteinG: 20, carbsG: 50, fatG: 20 }, 'ai_estimate'),
    ];
    await renderWithProviders(
      <DayOverview
        summary={summarizeEntries(estimated)}
        targets={NO_TARGETS}
        dayLabel="Today"
      />,
    );
    expect(screen.getByText('Includes AI estimates from photos')).toBeTruthy();
  });

  it('says nothing about estimates when every figure was entered by hand', async () => {
    await renderWithProviders(
      <DayOverview summary={summarizeEntries(DAY)} targets={NO_TARGETS} dayLabel="Today" />,
    );
    expect(screen.queryByText('Includes AI estimates from photos')).toBeNull();
  });

  it('renders an empty day without inventing anything', async () => {
    await renderWithProviders(
      <DayOverview summary={summarizeEntries([])} targets={NO_TARGETS} dayLabel="Today" />,
    );
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByLabelText('Nothing logged yet today.')).toBeTruthy();
  });

  it('names the day it is describing', async () => {
    await renderWithProviders(
      <DayOverview
        summary={summarizeEntries(DAY)}
        targets={NO_TARGETS}
        dayLabel="Yesterday"
      />,
    );
    expect(screen.getByText('YESTERDAY')).toBeTruthy();
  });
});
