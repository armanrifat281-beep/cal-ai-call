import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test/renderWithProviders';

import HomeScreen from '@/../app/(tabs)/index';

/**
 * The Recipes library - six sections, built from the user's own saved
 * recipes - could only be reached from Home by going into Discover first
 * and finding "See all". A feature that size, two taps behind another
 * screen, is one most people never find.
 *
 * Home now offers it directly, beside Discover. Insights is not here:
 * it stays hidden until there is enough logged for it to say anything.
 */
describe('the shortcuts on Home', () => {
  it('offers the recipe library', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.getByText('Your recipes')).toBeTruthy();
  });

  it('opens the existing Recipes screen, not a new one', async () => {
    await renderWithProviders(<HomeScreen />);

    fireEvent.press(screen.getByText('Your recipes'));

    expect(router.push).toHaveBeenCalledWith('/(tabs)/recipes');
  });

  it('still offers Discover, and keeps it separate', async () => {
    await renderWithProviders(<HomeScreen />);

    fireEvent.press(screen.getByText('Discover recipes'));

    expect(router.push).toHaveBeenCalledWith('/(tabs)/discover');
  });

  it('does not offer Insights while the journal is empty', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.queryByText('Insights')).toBeNull();
  });
});
