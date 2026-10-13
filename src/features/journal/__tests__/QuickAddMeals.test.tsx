import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import type { FoodEntryItem, SavedMeal } from '@/types/domain';

import { QuickAddMeals } from '../QuickAddMeals';
import { setJournalRepository } from '../hooks';
import type { CreateEntryInput, JournalRepository } from '../repository';

function item(name: string, kcal: number): FoodEntryItem {
  return {
    id: `${name}-i`,
    name,
    brand: null,
    portion: { quantity: 100, unit: 'g' },
    gramsResolved: 100,
    nutrients: {
      caloriesKcal: kcal,
      proteinG: 1,
      carbsG: 2,
      fatG: 3,
      fiberG: null,
      sugarG: null,
      saturatedFatG: null,
      sodiumMg: null,
    },
    provenance: {
      // Deliberately an estimate: re-logging must not upgrade it.
      source: 'ai_estimate',
      confidence: 'medium',
      providerLabel: 'some-model',
      providerRef: null,
    },
    foodRecordId: null,
    notes: null,
  };
}

function savedMeal(
  name: string,
  overrides: Partial<SavedMeal> = {},
): SavedMeal {
  return {
    id: `${name}-id`,
    userId: 'u1',
    name,
    mealType: 'breakfast',
    items: [item(name, 250)],
    useCount: 1,
    lastUsedAt: '2026-10-01T08:00:00.000Z',
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

interface Harness {
  created: CreateEntryInput[];
  usesRecorded: string[];
}

function repo(
  savedMeals: SavedMeal[],
  options: { failCreate?: boolean } = {},
): { repository: JournalRepository; calls: Harness } {
  const calls: Harness = { created: [], usesRecorded: [] };

  const repository = {
    kind: 'local',
    listSavedMeals: async () => ({ ok: true as const, value: savedMeals }),
    createEntry: async (input: CreateEntryInput) => {
      calls.created.push(input);
      if (options.failCreate) {
        return {
          ok: false as const,
          error: { code: 'unknown', message: 'Could not save that.', retryable: true },
        };
      }
      return { ok: true as const, value: { id: 'new-entry' } };
    },
    recordSavedMealUse: async (id: string) => {
      calls.usesRecorded.push(id);
      return { ok: true as const, value: savedMeal('x') };
    },
  } as unknown as JournalRepository;

  return { repository, calls };
}

describe('QuickAddMeals', () => {
  afterEach(() => {
    setJournalRepository(null);
  });

  /*
    An empty "quick add" rail on a new account would promise something the
    app has not earned yet, and filling it with examples would invent meals
    the user never ate.
  */
  it('draws nothing on an empty day, which is already asking for a meal', async () => {
    const { repository } = repo([]);
    setJournalRepository(repository);

    await renderWithProviders(
      <QuickAddMeals dateKey="2026-10-13" onAdded={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.queryByText('QUICK ADD')).toBeNull();
    });
  });

  /*
    Hiding the card entirely until a meal happened to be saved made a
    feature nobody could find: nothing on the screen said it existed, or
    that opening a meal was how to start.
  */
  it('says how to fill it on a day that has meals', async () => {
    const { repository } = repo([]);
    setJournalRepository(repository);

    await renderWithProviders(
      <QuickAddMeals dateKey="2026-10-13" onAdded={jest.fn()} hintWhenEmpty />,
    );

    expect(await screen.findByText('QUICK ADD')).toBeTruthy();
    expect(screen.getByText(/Save for quick add/)).toBeTruthy();
  });

  it('logs the tapped meal, keeping its items and meal type', async () => {
    const { repository, calls } = repo([savedMeal('Oats')]);
    setJournalRepository(repository);
    const onAdded = jest.fn();

    await renderWithProviders(
      <QuickAddMeals dateKey="2026-10-13" onAdded={onAdded} />,
    );

    fireEvent.press(await screen.findByText('Oats'));

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalled();
    });

    const created = calls.created[0];
    expect(created?.title).toBe('Oats');
    expect(created?.mealType).toBe('breakfast');
    expect(created?.items).toHaveLength(1);
  });

  /*
    Re-logging a meal must not quietly turn a model's guess into a
    measurement, which is the app's whole claim about its own numbers.
  */
  it('preserves provenance, so an estimate stays an estimate', async () => {
    const { repository, calls } = repo([savedMeal('Oats')]);
    setJournalRepository(repository);

    await renderWithProviders(
      <QuickAddMeals dateKey="2026-10-13" onAdded={jest.fn()} />,
    );

    fireEvent.press(await screen.findByText('Oats'));

    await waitFor(() => {
      expect(calls.created).toHaveLength(1);
    });
    expect(calls.created[0]?.items[0]?.provenance.source).toBe('ai_estimate');
  });

  it('records the meal on the day being viewed, not today', async () => {
    const { repository, calls } = repo([savedMeal('Oats')]);
    setJournalRepository(repository);

    await renderWithProviders(
      <QuickAddMeals dateKey="2026-01-05" onAdded={jest.fn()} />,
    );

    fireEvent.press(await screen.findByText('Oats'));

    await waitFor(() => {
      expect(calls.created).toHaveLength(1);
    });
    expect(calls.created[0]?.consumedAt).toContain('2026-01-05');
  });

  it('logs a meal saved without a meal type as a snack rather than refusing', async () => {
    const { repository, calls } = repo([savedMeal('Nuts', { mealType: null })]);
    setJournalRepository(repository);

    await renderWithProviders(
      <QuickAddMeals dateKey="2026-10-13" onAdded={jest.fn()} />,
    );

    fireEvent.press(await screen.findByText('Nuts'));

    await waitFor(() => {
      expect(calls.created).toHaveLength(1);
    });
    expect(calls.created[0]?.mealType).toBe('snack');
  });

  it('bumps the use count, which is what orders the list', async () => {
    const { repository, calls } = repo([savedMeal('Oats')]);
    setJournalRepository(repository);

    await renderWithProviders(
      <QuickAddMeals dateKey="2026-10-13" onAdded={jest.fn()} />,
    );

    fireEvent.press(await screen.findByText('Oats'));

    await waitFor(() => {
      expect(calls.usesRecorded).toEqual(['Oats-id']);
    });
  });

  it('shows the most-used meal first', async () => {
    const { repository } = repo([
      savedMeal('Rarely', { useCount: 1 }),
      savedMeal('Often', { useCount: 9 }),
    ]);
    setJournalRepository(repository);

    await renderWithProviders(
      <QuickAddMeals dateKey="2026-10-13" onAdded={jest.fn()} />,
    );

    await screen.findByText('Often');
    const names = screen
      .getAllByText(/^(Often|Rarely)$/)
      .map((node) => node.props.children);
    expect(names[0]).toBe('Often');
  });

  it('reports a failure and does not claim the meal was added', async () => {
    const { repository } = repo([savedMeal('Oats')], { failCreate: true });
    setJournalRepository(repository);
    const onAdded = jest.fn();

    await renderWithProviders(
      <QuickAddMeals dateKey="2026-10-13" onAdded={onAdded} />,
    );

    fireEvent.press(await screen.findByText('Oats'));

    await screen.findByText('Could not save that.');
    expect(onAdded).not.toHaveBeenCalled();
  });
});
