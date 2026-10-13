import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test/renderWithProviders';

import type { FoodEntryItem } from '@/types/domain';

import { MealActions } from '../MealActions';
import { setJournalRepository } from '../hooks';
import type { CreateSavedMealInput, JournalRepository } from '../repository';

function item(name: string): FoodEntryItem {
  return {
    id: `${name}-i`,
    name,
    brand: null,
    portion: { quantity: 100, unit: 'g' },
    gramsResolved: 100,
    nutrients: {
      caloriesKcal: 100,
      proteinG: 1,
      carbsG: 2,
      fatG: 3,
      fiberG: null,
      sugarG: null,
      saturatedFatG: null,
      sodiumMg: null,
    },
    provenance: {
      source: 'ai_estimate',
      confidence: 'medium',
      providerLabel: 'some-model',
      providerRef: null,
    },
    foodRecordId: null,
    notes: null,
  };
}

function repo(options: { fail?: boolean } = {}) {
  const saved: CreateSavedMealInput[] = [];

  const repository = {
    kind: 'local',
    listSavedMeals: async () => ({ ok: true as const, value: [] }),
    createSavedMeal: async (input: CreateSavedMealInput) => {
      saved.push(input);
      if (options.fail) {
        return {
          ok: false as const,
          error: { code: 'unknown', message: 'Could not save that.', retryable: true },
        };
      }
      return { ok: true as const, value: { id: 's1' } };
    },
  } as unknown as JournalRepository;

  return { repository, saved };
}

const SAVE = 'Save for quick add';
const COOK = 'Cook something with these';

describe('MealActions', () => {
  beforeEach(() => {
    (router.push as jest.Mock).mockClear();
  });

  afterEach(() => {
    setJournalRepository(null);
  });

  it('draws nothing when no food was identified', async () => {
    const { repository } = repo();
    setJournalRepository(repository);

    await renderWithProviders(<MealActions title="Empty" mealType="lunch" items={[]} />);

    expect(screen.queryByText(COOK)).toBeNull();
  });

  /*
    A shortcut to a meal that is not in the journal yet reads as a bug, so
    the scanner's review screen leaves this off.
  */
  it('offers saving only where the meal is already saved', async () => {
    const { repository } = repo();
    setJournalRepository(repository);

    await renderWithProviders(
      <MealActions title="Rice bowl" mealType="lunch" items={[item('Rice')]} />,
    );

    expect(screen.queryByText(SAVE)).toBeNull();
    expect(screen.getByText(COOK)).toBeTruthy();
  });

  it('saves the meal under its own name, type and items', async () => {
    const { repository, saved } = repo();
    setJournalRepository(repository);

    await renderWithProviders(
      <MealActions title="Rice bowl" mealType="lunch" items={[item('Rice')]} allowSaving />,
    );

    fireEvent.press(screen.getByText(SAVE));

    await screen.findByText('Saved for quick add');
    expect(saved).toEqual([
      { name: 'Rice bowl', mealType: 'lunch', items: [item('Rice')] },
    ]);
  });

  it('names an untitled meal rather than saving an empty name', async () => {
    const { repository, saved } = repo();
    setJournalRepository(repository);

    await renderWithProviders(
      <MealActions title="   " mealType={null} items={[item('Rice')]} allowSaving />,
    );

    fireEvent.press(screen.getByText(SAVE));

    await screen.findByText('Saved for quick add');
    expect(saved[0]?.name).toBe('Saved meal');
  });

  it('reports a failed save instead of claiming it worked', async () => {
    const { repository } = repo({ fail: true });
    setJournalRepository(repository);

    await renderWithProviders(
      <MealActions title="Rice bowl" mealType="lunch" items={[item('Rice')]} allowSaving />,
    );

    fireEvent.press(screen.getByText(SAVE));

    await screen.findByText('Could not save that.');
    expect(screen.queryByText('Saved for quick add')).toBeNull();
  });

  it('takes the identified foods to the recipe creator as what is on hand', async () => {
    const { repository } = repo();
    setJournalRepository(repository);

    await renderWithProviders(
      <MealActions
        title="Dinner"
        mealType="dinner"
        items={[item('Rice'), item('Grilled chicken')]}
      />,
    );

    fireEvent.press(screen.getByText(COOK));

    expect(router.push).toHaveBeenCalledWith(
      '/recipe/create?mode=from_pantry&pantry=Rice%2C%20Grilled%20chicken',
    );
  });
});
