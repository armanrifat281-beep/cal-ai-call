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
 * This is the state of a fresh checkout. The screens show the real form -
 * the app has to have a login page you can look at and set up - and say
 * plainly, above it, that the request at the end has nowhere to go. What
 * they must never do is behave as though it worked.
 *
 * The signed-in paths need a live project and are not asserted here.
 */

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sign in, with no backend configured', () => {
  it('shows the real form, because the app needs a login page', async () => {
    await renderWithProviders(<SignInScreen />);

    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('says above the form that it cannot work yet', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByText('Accounts are not set up in this build')).toBeTruthy();
  });

  it('checks the form before it tries anything', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignInScreen />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('That does not look like an email address.')).toBeTruthy();
  });

  it('reports the real reason on submit rather than appearing to sign in', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignInScreen />);

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText(/meals are saved on this device/),
    ).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalledWith('/(tabs)');
  });

  it('offers a way on without an account', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignInScreen />);

    await user.press(
      screen.getByRole('button', { name: 'Continue without an account' }),
    );
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('reaches the other two auth screens', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignInScreen />);

    await user.press(screen.getByRole('button', { name: 'I forgot my password' }));
    expect(router.push).toHaveBeenCalledWith('/(auth)/forgot-password');

    await user.press(
      screen.getByRole('button', { name: 'Create an account instead' }),
    );
    expect(router.replace).toHaveBeenCalledWith('/(auth)/sign-up');
  });
});

describe('sign up, with no backend configured', () => {
  it('shows the real form and says it cannot work yet', async () => {
    await renderWithProviders(<SignUpScreen />);

    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
    expect(screen.getByLabelText('Confirm password')).toBeTruthy();
    expect(screen.getByText('Accounts are not set up in this build')).toBeTruthy();
  });

  it('refuses a password that does not match its confirmation', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignUpScreen />);

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.type(screen.getByLabelText('Confirm password'), 'something else');
    await user.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Those passwords do not match.')).toBeTruthy();
  });

  it('never claims an account was made', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignUpScreen />);

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.type(screen.getByLabelText('Confirm password'), 'correct horse battery');
    await user.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.queryByText('Check your email')).toBeNull();
    expect(
      await screen.findByText(/meals are saved on this device/),
    ).toBeTruthy();
  });
});

describe('forgot password', () => {
  it('validates the email before sending anything', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<ForgotPasswordScreen />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.press(screen.getByRole('button', { name: 'Send a reset link' }));

    expect(screen.getByText('That does not look like an email address.')).toBeTruthy();
    // Still on the form, not on the confirmation screen.
    expect(screen.queryByText('Check your email')).toBeNull();
  });

  it('reports the configuration problem rather than claiming an email was sent', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<ForgotPasswordScreen />);

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.press(screen.getByRole('button', { name: 'Send a reset link' }));

    // With no backend there is no email, so it must not say one is on its way.
    expect(screen.queryByText(/reset link is on its way/)).toBeNull();
    expect(
      await screen.findByText(/meals are saved on this device/),
    ).toBeTruthy();
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
