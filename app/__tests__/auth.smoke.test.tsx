import { router } from 'expo-router';
import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import ForgotPasswordScreen from '../(auth)/forgot-password';
import SignInScreen from '../(auth)/sign-in';
import SignUpScreen from '../(auth)/sign-up';
import ProfileScreen from '../(tabs)/profile';

/**
 * Auth screens with no Supabase configured.
 *
 * This is the state of a fresh checkout, and the screens must say so plainly
 * rather than presenting a form that cannot work. The signed-in paths need a
 * live project and are not asserted here.
 */

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sign in, with no backend configured', () => {
  it('explains there is nothing to sign in to, instead of showing a dead form', async () => {
    await renderWithProviders(<SignInScreen />);

    expect(screen.getByText('Accounts are not set up in this build')).toBeTruthy();
    // No form that would fail on submit.
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to the app' })).toBeTruthy();
  });

  it('offers a way back into the app', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignInScreen />);

    await user.press(screen.getByRole('button', { name: 'Back to the app' }));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });
});

describe('sign up, with no backend configured', () => {
  it('says an account cannot be created and does not pretend otherwise', async () => {
    await renderWithProviders(<SignUpScreen />);

    expect(screen.getByText('Accounts are not set up in this build')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create account' })).toBeNull();
  });
});

describe('forgot password', () => {
  it('validates the email before sending anything', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<ForgotPasswordScreen />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.press(screen.getByRole('button', { name: 'Send reset link' }));

    expect(screen.getByText('That does not look like an email address.')).toBeTruthy();
    // Still on the form, not on the confirmation screen.
    expect(screen.queryByText('Check your email')).toBeNull();
  });

  it('reports the configuration problem rather than claiming an email was sent', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<ForgotPasswordScreen />);

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.press(screen.getByRole('button', { name: 'Send reset link' }));

    // With no backend there is no email, so it must not say one is on its way.
    expect(screen.queryByText(/reset link is on its way/)).toBeNull();
    expect(screen.getByText(/not set up in this build/)).toBeTruthy();
  });
});

describe('profile account section', () => {
  it('states that meals are local only when there is no backend', async () => {
    await renderWithProviders(<ProfileScreen />);

    expect(screen.getByText('No account in this build')).toBeTruthy();
    expect(screen.getByText('Meals are saved on this device only')).toBeTruthy();
  });

  it('does not offer sign-in when there is nothing to sign in to', async () => {
    await renderWithProviders(<ProfileScreen />);

    expect(screen.queryByText('Sign in')).toBeNull();
    expect(screen.queryByText('Delete my account')).toBeNull();
  });

  it('still offers local data deletion', async () => {
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Delete everything on this device')).toBeTruthy();
  });
});
