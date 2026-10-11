import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, userEvent } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { useTheme, useThemeContext } from '..';

/**
 * Proves the Appearance control actually repaints the app.
 *
 * The control was wired and nothing checked that choosing Dark changed a
 * single pixel, which is exactly the kind of thing that can be broken for
 * months without anyone noticing in a test suite.
 */
function Probe() {
  const theme = useTheme();
  const { preference, setPreference } = useThemeContext();

  return (
    <View testID="page" style={{ backgroundColor: theme.colors.background }}>
      <Text>{`${preference}:${theme.scheme}:${theme.colors.background}`}</Text>
      <Text testID="to-dark" onPress={() => setPreference('dark')}>
        Dark
      </Text>
      <Text testID="to-light" onPress={() => setPreference('light')}>
        Light
      </Text>
      <Text testID="to-system" onPress={() => setPreference('system')}>
        System
      </Text>
    </View>
  );
}

beforeEach(async () => {
  // The choice is persisted, so without this each test inherits whatever
  // the previous one picked.
  await AsyncStorage.clear();
});

describe('switching appearance', () => {
  it('opens dark on a fresh install', async () => {
    await renderWithProviders(<Probe />);
    expect(screen.getByText(/^dark:dark:/)).toBeTruthy();
  });

  it('still offers following the phone', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Probe />);

    await user.press(screen.getByTestId('to-system'));
    expect(screen.getByText(/^system:/)).toBeTruthy();
  });

  it('repaints the page when Light is chosen', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Probe />);

    const before = screen.getByTestId('page').props.style.backgroundColor;
    await user.press(screen.getByTestId('to-light'));

    expect(screen.getByText(/^light:light:/)).toBeTruthy();
    expect(screen.getByTestId('page').props.style.backgroundColor).not.toBe(before);
  });

  it('goes back to dark', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Probe />);

    await user.press(screen.getByTestId('to-light'));
    await user.press(screen.getByTestId('to-dark'));
    expect(screen.getByText(/^dark:dark:/)).toBeTruthy();
  });

  it('gives dark mode a genuinely dark page', async () => {
    await renderWithProviders(<Probe />);

    const background = screen.getByTestId('page').props.style
      .backgroundColor as string;
    const channels = [1, 3, 5].map((index) =>
      parseInt(background.slice(index, index + 2), 16),
    );
    // Every channel near zero: a dark page, not a dim one.
    expect(Math.max(...channels)).toBeLessThan(40);
  });

  it('keeps the page neutral rather than tinted', async () => {
    // A warm near-black reads as brown on a phone screen, which is not what
    // "dark mode" is understood to mean.
    await renderWithProviders(<Probe />);

    const background = screen.getByTestId('page').props.style
      .backgroundColor as string;
    const [r, g, b] = [1, 3, 5].map((index) =>
      parseInt(background.slice(index, index + 2), 16),
    );
    const spread = Math.max(r!, g!, b!) - Math.min(r!, g!, b!);
    expect(spread).toBeLessThanOrEqual(6);
  });
});
