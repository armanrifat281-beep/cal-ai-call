import { screen, userEvent } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { PressableScale } from '../PressableScale';
import { Text } from '../Text';

describe('PressableScale', () => {
  it('calls back when pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Tap">
        <Text>Tap</Text>
      </PressableScale>,
    );

    await user.press(screen.getByRole('button', { name: 'Tap' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call back while disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <PressableScale
        onPress={onPress}
        disabled
        accessibilityRole="button"
        accessibilityLabel="Tap"
      >
        <Text>Tap</Text>
      </PressableScale>,
    );

    await user.press(screen.getByRole('button', { name: 'Tap' }));

    expect(onPress).not.toHaveBeenCalled();
  });

  /*
    The defect this guards against: the component used to put the caller's
    style on a Pressable nested inside an Animated.View, so any layout asked
    for - `flex`, `width`, `alignSelf` - was applied to a child of a wrapper
    that sized itself to its content. Three `flex` buttons in a row came out
    squashed against the left edge with their labels clipped, and a week
    strip's seven equal columns were not equal at all.
  */
  it('puts the layout the caller asked for on the element the parent lays out', async () => {
    await renderWithProviders(
      <View style={{ flexDirection: 'row' }}>
        <PressableScale
          style={{ flex: 2 }}
          accessibilityRole="button"
          accessibilityLabel="Wide"
        >
          <Text>Wide</Text>
        </PressableScale>
      </View>,
    );

    const styles = screen.getByRole('button', { name: 'Wide' }).props.style;
    const flattened = Array.isArray(styles) ? Object.assign({}, ...styles.flat()) : styles;

    expect(flattened.flex).toBe(2);
  });

  it('keeps the caller style and the press transform on one element', async () => {
    await renderWithProviders(
      <PressableScale
        style={{ alignSelf: 'stretch' }}
        accessibilityRole="button"
        accessibilityLabel="Stretched"
      >
        <Text>Stretched</Text>
      </PressableScale>,
    );

    const styles = screen.getByRole('button', { name: 'Stretched' }).props.style;
    const flattened = Array.isArray(styles) ? Object.assign({}, ...styles.flat()) : styles;

    expect(flattened.alignSelf).toBe('stretch');
    expect(flattened.transform).toBeDefined();
  });
});
