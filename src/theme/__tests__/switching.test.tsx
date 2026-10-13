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
  /*
    Follows the phone. Forcing dark gave someone whose phone is set to light
    a dark app they never asked for and could only read as a bug, and it
    meant the cream-and-forest identity was the one thing a new user never
    saw.
  */
  it('follows the phone on a fresh install', async () => {
    await renderWithProviders(<Probe />);
    expect(screen.getByText(/^system:/)).toBeTruthy();
  });

  it('still offers following the phone after a choice was made', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Probe />);

    await user.press(screen.getByTestId('to-dark'));
    await user.press(screen.getByTestId('to-system'));
    expect(screen.getByText(/^system:/)).toBeTruthy();
  });

  it('repaints the page when Light is chosen', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Probe />);
    // From dark, because the default now follows the phone, which under
    // test is already light - choosing Light from there repaints nothing.
    await user.press(screen.getByTestId('to-dark'));

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
    const user = userEvent.setup();
    await renderWithProviders(<Probe />);
    // Chosen explicitly: the default follows the phone now, which under test
    // is light.
    await user.press(screen.getByTestId('to-dark'));

    const background = screen.getByTestId('page').props.style
      .backgroundColor as string;
    const channels = [1, 3, 5].map((index) =>
      parseInt(background.slice(index, index + 2), 16),
    );
    // Every channel near zero: a dark page, not a dim one.
    expect(Math.max(...channels)).toBeLessThan(40);
  });

  it('keeps the page close to neutral rather than tinted', async () => {
    /*
      The page carries a little warmth so food photography does not look
      refrigerated against it, and no more than a little: a previous version
      was a clay that read as brown in dark mode and beige in light. The
      bound is what separates "warm" from "a colour".
    */
    const user = userEvent.setup();
    await renderWithProviders(<Probe />);
    await user.press(screen.getByTestId('to-dark'));

    const background = screen.getByTestId('page').props.style
      .backgroundColor as string;
    const [r, g, b] = [1, 3, 5].map((index) =>
      parseInt(background.slice(index, index + 2), 16),
    );
    const spread = Math.max(r!, g!, b!) - Math.min(r!, g!, b!);
    expect(spread).toBeLessThanOrEqual(6);
  });
});
