import { waitFor } from '@testing-library/react-native';

import { renderHookWithProviders } from '@/test/renderWithProviders';

import type { FoodEntry } from '@/types/domain';

import { setJournalRepository, useDayAndWeek } from '../hooks';
import type { JournalRepository } from '../repository';

function entry(dateKey: string, kcal: number, id = dateKey): FoodEntry {
  return {
    id,
    userId: 'u1',
    consumedAt: `${dateKey}T12:00:00.000Z`,
    mealType: 'lunch',
    title: 'Lunch',
    items: [
      {
        id: `${id}-i`,
        name: 'Food',
        brand: null,
        portion: { quantity: 100, unit: 'g' },
        gramsResolved: 100,
        nutrients: {
          caloriesKcal: kcal,
          proteinG: 0,
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
    createdAt: `${dateKey}T12:00:00.000Z`,
    updatedAt: `${dateKey}T12:00:00.000Z`,
  };
}

function repo(entries: FoodEntry[]) {
  const calls = { range: 0, day: 0 };
  const repository = {
    kind: 'local',
    listEntriesForRange: async () => {
      calls.range += 1;
      return { ok: true as const, value: entries };
    },
    listEntriesForDay: async () => {
      calls.day += 1;
      return { ok: true as const, value: entries };
    },
  } as unknown as JournalRepository;
  return { repository, calls };
}

afterEach(() => setJournalRepository(null));

describe('useDayAndWeek', () => {
  /*
    Home used to ask for the day and the week separately, although the
    week's range already contained the day. Two independent reads also meant
    the dial and the strip could briefly disagree about the same day after a
    save.
  */
  it('reads once, not once per thing it feeds', async () => {
    const { repository, calls } = repo([]);
    setJournalRepository(repository);

    const { result } = await renderHookWithProviders(() => useDayAndWeek('2026-10-13'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(calls.range).toBe(1);
    expect(calls.day).toBe(0);
  });

  it('gives the day its own entries, not the whole week', async () => {
    const { repository } = repo([
      entry('2026-10-13', 500, 'today'),
      entry('2026-10-11', 700, 'older'),
    ]);
    setJournalRepository(repository);

    const { result } = await renderHookWithProviders(() => useDayAndWeek('2026-10-13'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.entries.map((e) => e.id)).toEqual(['today']);
    expect(result.current.summary.totals.nutrients.caloriesKcal).toBe(500);
  });

  it('gives the strip seven days, ending on the one asked for', async () => {
    const { repository } = repo([entry('2026-10-13', 500)]);
    setJournalRepository(repository);

    const { result } = await renderHookWithProviders(() => useDayAndWeek('2026-10-13'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.week).toHaveLength(7);
    expect(result.current.week[6]?.dateKey).toBe('2026-10-13');
  });

  // The whole point of one read: both views are built from the same answer.
  it('agrees with itself about the day in both views', async () => {
    const { repository } = repo([
      entry('2026-10-13', 300, 'a'),
      entry('2026-10-13', 200, 'b'),
    ]);
    setJournalRepository(repository);

    const { result } = await renderHookWithProviders(() => useDayAndWeek('2026-10-13'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const stripToday = result.current.week.find((d) => d.dateKey === '2026-10-13');
    expect(stripToday?.caloriesKcal).toBe(
      result.current.summary.totals.nutrients.caloriesKcal,
    );
    expect(stripToday?.entryCount).toBe(result.current.entries.length);
  });

  it('reports a day with nothing logged as empty, not missing', async () => {
    const { repository } = repo([]);
    setJournalRepository(repository);

    const { result } = await renderHookWithProviders(() => useDayAndWeek('2026-10-13'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.entries).toEqual([]);
    expect(result.current.week.every((d) => d.entryCount === 0)).toBe(true);
  });
});
