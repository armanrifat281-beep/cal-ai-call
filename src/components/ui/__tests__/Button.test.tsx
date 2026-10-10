import { render, screen, userEvent } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme';

import { Button } from '../Button';

/** React Native Testing Library 14 renders asynchronously, so this awaits. */
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('Button', () => {
  it('renders its label and is reachable as a button', async () => {
    await renderWithTheme(<Button label="Save meal" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Save meal' })).toBeTruthy();
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithTheme(<Button label="Save meal" onPress={onPress} />);

    await user.press(screen.getByRole('button', { name: 'Save meal' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress while disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithTheme(<Button label="Save meal" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Save meal' });
    expect(button).toBeDisabled();
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('blocks presses while loading, so a slow save cannot be submitted twice', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithTheme(<Button label="Saving" onPress={onPress} loading />);

    await user.press(screen.getByRole('button', { name: 'Saving' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes a busy state to assistive technology while loading', async () => {
    await renderWithTheme(<Button label="Saving" onPress={jest.fn()} loading />);
    expect(screen.getByRole('button', { name: 'Saving' })).toBeBusy();
  });
});
