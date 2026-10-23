import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, userEvent } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { SchemeOverride, useTheme, useThemeContext } from '..';

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
    Opens dark. The product is drawn against a black page - the calorie
    ring, the meal list and the day's score were all designed on one, and
    the lime identity colour only means anything there - so following the
    phone meant roughly half of all new users saw a washed-out version of a
    design that was never drawn.

    It is a default, not a lock: the two tests below are what keep Light and
    System one tap away.
  */
  it('opens dark on a fresh install', async () => {
    await renderWithProviders(<Probe />);
    expect(screen.getByText(/^dark:/)).toBeTruthy();
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

/**
 * Two screens are drawn pale whatever the user picked.
 *
 * `SchemeOverride` is how, and these pin the two properties the rest of the
 * app depends on: that it actually changes the palette inside it, and that
 * it changes nothing outside it - including the stored preference, which the
 * Appearance control still has to read and write correctly.
 */
describe('overriding the scheme for part of the tree', () => {
  function Nested() {
    const theme = useTheme();
    const { preference } = useThemeContext();
    return (
      <Text testID="nested">{`${preference}:${theme.scheme}:${theme.colors.background}`}</Text>
    );
  }

  it('paints the subtree light while the app is dark', async () => {
    await renderWithProviders(
      <View>
        <Probe />
        <SchemeOverride scheme="light">
          <Nested />
        </SchemeOverride>
      </View>,
    );

    // The app at large, untouched.
    expect(screen.getByText(/^dark:dark:/)).toBeTruthy();
    // And the part that is drawn on paper.
    expect(screen.getByTestId('nested').props.children).toMatch(/^dark:light:/);
  });

  /*
    The user's own choice passes straight through. If this read the
    preference instead of passing it on, Appearance in Settings would stop
    reporting what the user picked whenever it was rendered inside one of
    these screens.
  */
  it('leaves the stored preference alone', async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <View>
        <Probe />
        <SchemeOverride scheme="light">
          <Nested />
        </SchemeOverride>
      </View>,
    );

    await user.press(screen.getByTestId('to-system'));
    expect(screen.getByTestId('nested').props.children).toMatch(/^system:light:/);
  });
});
