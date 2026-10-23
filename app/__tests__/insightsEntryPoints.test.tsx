import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import HomeScreen from '@/../app/(tabs)/index';
import ProfileScreen from '@/../app/(tabs)/profile';
import ProgressScreen from '@/../app/(tabs)/progress';

/**
 * Four separate places offered a way into Insights - two on Home, one on
 * Progress, one on Profile - and all four did it from the first launch,
 * before anything had been logged. Insights needs three meals across two
 * days before it will say anything, so every one of them led to "Not enough
 * logged yet". A link that always ends in an empty screen reads as a broken
 * feature, and this was a new user's first impression of the app.
 *
 * With nothing logged, none of the three screens should offer it. The
 * screens still open, and everything else on them still draws.
 */

const SCREENS: [string, React.ComponentType][] = [
  ['Home', HomeScreen],
  ['Progress', ProgressScreen],
  ['Profile', ProfileScreen],
];

describe('with an empty journal', () => {
  it.each(SCREENS)('%s offers no way into Insights', async (_name, Component) => {
    await renderWithProviders(<Component />);

    expect(screen.queryByText('Insights')).toBeNull();
    expect(screen.queryByText('Food patterns')).toBeNull();
    // The macro card's button is the least obvious of the four.
    expect(screen.queryByText('View details')).toBeNull();
  });

  it.each(SCREENS)('%s still renders', async (_name, Component) => {
    const view = await renderWithProviders(<Component />);
    expect(view.toJSON()).not.toBeNull();
  });
});
