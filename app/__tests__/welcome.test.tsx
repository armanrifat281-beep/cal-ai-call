import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test/renderWithProviders';

import WelcomeScreen from '../(auth)/welcome';

/**
 * The first screen a signed-out visitor sees.
 *
 * The boot gate used to redirect them straight to the sign-in form, which
 * asked for an email address before saying what the app was. These assert
 * that both doors are on the screen and that each opens the right one -
 * wiring that breaks silently, because the screen still looks correct when a
 * button goes nowhere.
 */
describe('the welcome screen', () => {
  beforeEach(() => {
    (router.push as jest.Mock).mockClear();
  });

  it('says what the app does before asking for anything', async () => {
    await renderWithProviders(<WelcomeScreen />);

    expect(screen.getByText(/measured and which were estimated/)).toBeTruthy();
  });

  it('offers both doors, so a returning user is not stuck', async () => {
    await renderWithProviders(<WelcomeScreen />);

    expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'I already have an account' }),
    ).toBeTruthy();
  });

  it('opens sign-up from "Get started"', async () => {
    await renderWithProviders(<WelcomeScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Get started' }));

    expect(router.push).toHaveBeenCalledWith('/(auth)/sign-up');
  });

  it('opens sign-in for someone who has been here before', async () => {
    await renderWithProviders(<WelcomeScreen />);

    fireEvent.press(
      screen.getByRole('button', { name: 'I already have an account' }),
    );

    expect(router.push).toHaveBeenCalledWith('/(auth)/sign-in');
  });
});
