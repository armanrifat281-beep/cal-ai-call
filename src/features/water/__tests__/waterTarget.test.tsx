import { screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';
import { usePreferencesStore } from '@/store/preferencesStore';

import { WaterCard } from '../WaterCard';

/**
 * The target is the user's own, and null by default. The app does not tell
 * anyone how much they should drink; it counts what they did.
 */

afterEach(() => {
  usePreferencesStore.getState().setPreferences({ waterTargetMl: null });
});

describe('WaterCard', () => {
  it('counts without a target until the user sets one', async () => {
    await renderWithProviders(<WaterCard />);

    await waitFor(() => expect(screen.getByText('Water')).toBeTruthy());
    // Eight marks as a scale to read against, and nothing anywhere saying
    // how much of it the user is supposed to drink.
    expect(screen.getByLabelText('0 of 8 glasses')).toBeTruthy();
    expect(screen.queryByText(/\/ .* L/)).toBeNull();
  });

  it('draws one mark per 250 ml of the target the user set', async () => {
    usePreferencesStore.getState().setPreferences({ waterTargetMl: 1500 });
    await renderWithProviders(<WaterCard />);

    await waitFor(() => expect(screen.getByText('Water')).toBeTruthy());
    expect(screen.getByLabelText('0 of 6 glasses')).toBeTruthy();
    expect(screen.getByText('/ 1.5 L')).toBeTruthy();
  });

  // Twenty-four marks across half a phone would be two pixels each, which
  // is a texture rather than a reading.
  it('keeps the gauge readable when the target is very large', async () => {
    usePreferencesStore.getState().setPreferences({ waterTargetMl: 6000 });
    await renderWithProviders(<WaterCard />);

    await waitFor(() => expect(screen.getByText('Water')).toBeTruthy());
    expect(screen.getByLabelText('0 of 12 glasses')).toBeTruthy();
  });
});
