import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';
import { usePreferencesStore } from '@/store/preferencesStore';
import { EMPTY_NUTRIENTS, type FoodEntryItem } from '@/types/domain';

import { MealEditor, type MealDraft } from '../MealEditor';
import { MealPhotoField } from '../MealPhotoField';

const PHOTO = 'file:///cache/meal-capture.jpg';

function item(): FoodEntryItem {
  return {
    id: 'item-1',
    name: 'Grilled chicken',
    brand: null,
    portion: { quantity: 150, unit: 'g' },
    gramsResolved: 150,
    nutrients: { ...EMPTY_NUTRIENTS, caloriesKcal: 240, proteinG: 45, carbsG: 0, fatG: 6 },
    provenance: {
      source: 'user_entered',
      confidence: 'high',
      providerLabel: null,
      providerRef: null,
    },
    foodRecordId: null,
    notes: null,
  };
}

beforeEach(() => {
  usePreferencesStore.getState().reset();
});

describe('MealPhotoField', () => {
  it('renders nothing when there is no photo', async () => {
    await renderWithProviders(<MealPhotoField uri={null} onChange={jest.fn()} />);

    expect(screen.queryByText('Preview only')).toBeNull();
    expect(screen.queryByText(/Saved with this meal/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('warns that the photo will not be kept while the setting is off', async () => {
    // Off is the default, and onboarding promises the journal then keeps
    // "only the food names and numbers".
    await renderWithProviders(<MealPhotoField uri={PHOTO} onChange={jest.fn()} />);

    expect(screen.getByText('Preview only')).toBeTruthy();
    expect(screen.getByText(/will not be saved with the meal/)).toBeTruthy();
    expect(screen.queryByText(/Saved with this meal/)).toBeNull();
  });

  it('offers to turn keeping on, at the moment the choice matters', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<MealPhotoField uri={PHOTO} onChange={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: 'Keep my photos' }));

    expect(usePreferencesStore.getState().preferences.retainPhotos).toBe(true);
    expect(screen.getByText(/Saved with this meal/)).toBeTruthy();
    expect(screen.queryByText('Preview only')).toBeNull();
  });

  it('says the photo is kept on the device once the setting is on', async () => {
    usePreferencesStore.getState().setPreferences({ retainPhotos: true });
    await renderWithProviders(<MealPhotoField uri={PHOTO} onChange={jest.fn()} />);

    expect(screen.getByText('Saved with this meal, on this device')).toBeTruthy();
  });

  it('clears the photo when removed', async () => {
    usePreferencesStore.getState().setPreferences({ retainPhotos: true });
    const onChange = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(<MealPhotoField uri={PHOTO} onChange={onChange} />);

    await user.press(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('clears the photo when discarded from the preview state', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(<MealPhotoField uri={PHOTO} onChange={onChange} />);

    await user.press(screen.getByRole('button', { name: 'Discard' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('MealEditor photo handover', () => {
  it('carries the scanner photo into the saved draft', async () => {
    usePreferencesStore.getState().setPreferences({ retainPhotos: true });
    const onSave = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor
        mode="create"
        initial={{ items: [item()] }}
        initialPhotoUri={PHOTO}
        saving={false}
        saveError={null}
        onSave={onSave}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Save meal' }));

    const draft = onSave.mock.calls[0]?.[0] as MealDraft;
    expect(draft.photoUri).toBe(PHOTO);
  });

  it('saves without a photo when the user removes it', async () => {
    usePreferencesStore.getState().setPreferences({ retainPhotos: true });
    const onSave = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor
        mode="create"
        initial={{ items: [item()] }}
        initialPhotoUri={PHOTO}
        saving={false}
        saveError={null}
        onSave={onSave}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Remove' }));
    await user.press(screen.getByRole('button', { name: 'Save meal' }));

    const draft = onSave.mock.calls[0]?.[0] as MealDraft;
    expect(draft.photoUri).toBeNull();
  });

  it('reports no photo for a meal that never had one', async () => {
    const onSave = jest.fn();
    const user = userEvent.setup();

    await renderWithProviders(
      <MealEditor
        mode="create"
        initial={{ items: [item()] }}
        saving={false}
        saveError={null}
        onSave={onSave}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Save meal' }));
    const draft = onSave.mock.calls[0]?.[0] as MealDraft;
    expect(draft.photoUri).toBeNull();
  });
});
