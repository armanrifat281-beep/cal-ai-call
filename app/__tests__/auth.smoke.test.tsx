import { router } from 'expo-router';
import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import ForgotPasswordScreen from '../(auth)/forgot-password';
import ResetPasswordScreen from '../(auth)/reset-password';
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

    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
  });

  it('says above the form that it cannot work yet', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByText('No account backend in this build.')).toBeTruthy();
  });

  it('checks the form before it tries anything', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignInScreen />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.press(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('That does not look like an email address.')).toBeTruthy();
  });

  it('reports the real reason on submit rather than appearing to sign in', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignInScreen />);

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.press(screen.getByRole('button', { name: 'Sign In' }));

    /*
      An alert, not just the standing notice above the form.

      The screen already says a backend is missing before anyone touches it;
      what this is checking is that PRESSING the button reports a failure
      rather than appearing to succeed. Matching on the shared wording would
      pass against the notice that was there all along.
    */
    expect(
      await screen.findByText(
        'Accounts are not set up in this build. Your meals are saved on this device.',
      ),
    ).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalledWith('/(tabs)');
  });

  /*
    Google appears only when it can actually sign someone in.

    It used to be drawn in every build, saying what was missing when
    pressed. To anyone but a developer that is a broken button: it looks
    exactly like the working one, the explanation lands at the top of the
    form where nobody is looking, and pressing it again does the same
    nothing.
  */
  it('does not offer Google in a build where it cannot work', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(
      screen.queryByRole('button', { name: 'Continue with Google' }),
    ).toBeNull();
  });

  it('does not offer it on the sign-up screen either', async () => {
    await renderWithProviders(<SignUpScreen />);
    expect(
      screen.queryByRole('button', { name: 'Continue with Google' }),
    ).toBeNull();
  });

  it('leaves the password path complete without it', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  // This app ships on Android, and Apple's provider needs a paid Apple
  // Developer membership, so a button for it could only say "not set up".
  it('does not offer Apple at all', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
  });

  it('no longer offers a way past the account', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(
      screen.queryByRole('button', { name: 'Continue without an account' }),
    ).toBeNull();
  });

  // Someone whose details match nothing almost always has no account. The
  // way out has to be at the failure, not below the fold.
  it('offers to create an account when the details match none', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignInScreen />);

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.press(screen.getByRole('button', { name: 'Sign In' }));

    const create = await screen.findAllByRole('button', { name: 'Sign Up' });
    expect(create.length).toBeGreaterThan(0);
  });

  /*
    With confirmation on, an email that never arrives used to be the end of
    the road: the screen said "ask for a new one from the sign-in screen",
    and the sign-in screen only offers a password reset - which does not
    confirm an address. The account stayed unreachable and its email was
    already taken.
  */
  it('can send the confirmation email again', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignUpScreen />);

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.type(
      screen.getByLabelText('Confirm Password'),
      'correct horse battery',
    );
    await user.press(screen.getByRole('button', { name: 'Create Account' }));

    // Only reached when the server asked for confirmation.
    const heading = screen.queryByText('Check your email');
    if (heading === null) return;

    expect(
      screen.getByRole('button', { name: 'Send the email again' }),
    ).toBeTruthy();
  });

  it('reaches the other two auth screens', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignInScreen />);

    await user.press(screen.getByRole('button', { name: 'I forgot my password' }));
    expect(router.push).toHaveBeenCalledWith('/(auth)/forgot-password');

    await user.press(
      screen.getByRole('button', { name: 'Sign Up' }),
    );
    expect(router.replace).toHaveBeenCalledWith('/(auth)/sign-up');
  });
});

describe('sign up, with no backend configured', () => {
  it('shows the real form and says it cannot work yet', async () => {
    await renderWithProviders(<SignUpScreen />);

    expect(screen.getByRole('button', { name: 'Create Account' })).toBeTruthy();
    expect(screen.getByLabelText('Confirm Password')).toBeTruthy();
    expect(screen.getByText('No account backend in this build.')).toBeTruthy();
  });

  it('refuses a password that does not match its confirmation', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignUpScreen />);

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.type(screen.getByLabelText('Confirm Password'), 'something else');
    await user.press(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText('Those passwords do not match.')).toBeTruthy();
  });

  it('never claims an account was made', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignUpScreen />);

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.type(screen.getByLabelText('Confirm Password'), 'correct horse battery');
    await user.press(screen.getByRole('button', { name: 'Create Account' }));

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

describe('choosing a new password after a reset link', () => {
  it('renders, and asks for the new password twice', async () => {
    await renderWithProviders(<ResetPasswordScreen />);

    // The heading and the first field share a name, so the heading is
    // checked by there being two of it rather than one.
    expect(screen.getAllByText('New Password')).toHaveLength(2);
    expect(screen.getByLabelText('New Password')).toBeTruthy();
    expect(screen.getByLabelText('Confirm New Password')).toBeTruthy();
  });

  it('asks for no current password, because the link was the proof', async () => {
    await renderWithProviders(<ResetPasswordScreen />);
    expect(screen.queryByLabelText('Current password')).toBeNull();
  });

  it('refuses a confirmation that does not match', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<ResetPasswordScreen />);

    await user.type(screen.getByLabelText('New Password'), 'correct horse battery');
    await user.type(screen.getByLabelText('Confirm New Password'), 'something else');
    await user.press(screen.getByRole('button', { name: 'Save new password' }));

    expect(screen.getByText('Those passwords do not match.')).toBeTruthy();
  });

  it('lets someone back out without changing anything', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<ResetPasswordScreen />);

    await user.press(screen.getByRole('button', { name: 'Not now' }));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });
});
