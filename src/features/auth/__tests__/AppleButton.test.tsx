import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { AppleButton } from '../AppleButton';

/**
 * Apple specifies how this button may look, and the penalty for ignoring
 * that is a rejected submission rather than a design opinion. These pin the
 * parts a future tidy-up would be most tempted to "fix" into the app's own
 * styling.
 *
 * Tests run with no native module, so this is the web-flow fallback - the
 * one that has to follow the rules by hand. On iOS the system draws the
 * button and none of this applies.
 */
function fill(): string | undefined {
  const node = screen.getByRole('button', { name: 'Continue with Apple' });
  const style = node.props.style;
  const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
  return flat?.backgroundColor as string | undefined;
}

describe('the Sign in with Apple button', () => {
  it('uses one of Apple’s permitted fills, exactly', async () => {
    await renderWithProviders(<AppleButton onPress={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeTruthy(),
    );
    // Pure white or pure black, not the app's near-white and near-black.
    expect(['#FFFFFF', '#000000']).toContain(fill());
  });

  it('inverts against the page, as every filled button here does', async () => {
    // The providers open dark, so the button is the white one.
    await renderWithProviders(<AppleButton onPress={jest.fn()} />);
    await waitFor(() => expect(fill()).toBe('#FFFFFF'));
  });

  it('says what Apple allows it to say', async () => {
    await renderWithProviders(<AppleButton onPress={jest.fn()} />);
    expect(await screen.findByText('Continue with Apple')).toBeTruthy();
  });

  it('matches the height of the app’s large button, so the row lines up', async () => {
    await renderWithProviders(<AppleButton onPress={jest.fn()} />);
    await waitFor(() => expect(fill()).toBeTruthy());

    const node = screen.getByRole('button', { name: 'Continue with Apple' });
    const style = node.props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.height).toBe(62);
    // A pill, like the rest.
    expect(flat.borderRadius).toBe(31);
  });

  it('signs in when pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(<AppleButton onPress={onPress} />);

    await waitFor(() => expect(fill()).toBeTruthy());
    await user.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('does not fire twice while a sign-in is already running', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(<AppleButton onPress={onPress} loading />);

    await waitFor(() => expect(fill()).toBeTruthy());
    await user.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
