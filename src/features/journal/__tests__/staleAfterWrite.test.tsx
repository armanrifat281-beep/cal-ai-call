import { act, waitFor } from '@testing-library/react-native';

import { renderHookWithProviders } from '@/test/renderWithProviders';

import type { FoodEntry } from '@/types/domain';

import {
  getDeviceJournalRepository,
  setJournalRepository,
  useDayJournal,
  useSavedMeals,
} from '../hooks';
import type { JournalRepository } from '../repository';
import { resetJournalRevision } from '../revision';

/**
 * Saving a meal left every other screen showing what it read when it was
 * first opened.
 *
 * The tabs stay mounted, and the read hooks depended only on the date and
 * the repository - neither of which changes when something is written. So
 * scanning a meal, saving it, and tapping Progress showed "Nothing logged
 * today" over an entry that was already stored. `revision.ts` was written
 * to solve exactly this and says so at the top, but nothing ever used it:
 * the counter was exported, never read, and no repository was ever wrapped
 * to bump it.
 */

const DAY = '2026-10-23';

function entry(id: string): FoodEntry {
  return {
    id,
    userId: 'u1',
    consumedAt: `${DAY}T12:00:00.000Z`,
    mealType: 'lunch',
    title: 'Lunch',
    items: [],
    photoPath: null,
    notes: null,
    createdAt: `${DAY}T12:00:00.000Z`,
    updatedAt: `${DAY}T12:00:00.000Z`,
  };
}

/** A repository whose contents can change under a mounted hook. */
function repo() {
  const entries: FoodEntry[] = [];
  const savedMeals: { id: string }[] = [];
  const repository = {
    kind: 'local',
    listEntriesForDay: async () => ({ ok: true as const, value: [...entries] }),
    listEntriesForRange: async () => ({ ok: true as const, value: [...entries] }),
    listSavedMeals: async () => ({ ok: true as const, value: [...savedMeals] }),
    createEntry: async () => {
      const created = entry(`e${entries.length + 1}`);
      entries.push(created);
      return { ok: true as const, value: created };
    },
    deleteEntry: async () => {
      entries.pop();
      return { ok: true as const, value: undefined };
    },
    createSavedMeal: async () => {
      savedMeals.push({ id: `m${savedMeals.length + 1}` });
      return { ok: true as const, value: savedMeals[savedMeals.length - 1] };
    },
  } as unknown as JournalRepository;
  return repository;
}

afterEach(() => {
  setJournalRepository(null);
  resetJournalRevision();
});

describe('a write anywhere refreshes what is on screen', () => {
  it('shows a saved meal without the screen being reloaded by hand', async () => {
    setJournalRepository(repo());

    const { result } = await renderHookWithProviders(() => useDayJournal(DAY));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(0);

    // The scan screen saves through the repository, not through this hook.
    await act(async () => {
      await getDeviceJournalRepository().createEntry({} as never);
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
  });

  it('notices a deletion too, not just an addition', async () => {
    setJournalRepository(repo());
    const repository = getDeviceJournalRepository();
    await repository.createEntry({} as never);

    const { result } = await renderHookWithProviders(() => useDayJournal(DAY));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    await act(async () => {
      await repository.deleteEntry('e1');
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(0));
  });

  it('refreshes saved meals on the same signal', async () => {
    setJournalRepository(repo());

    const { result } = await renderHookWithProviders(() => useSavedMeals());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.savedMeals).toHaveLength(0);

    await act(async () => {
      await getDeviceJournalRepository().createSavedMeal({} as never);
    });

    await waitFor(() => expect(result.current.savedMeals).toHaveLength(1));
  });
});
