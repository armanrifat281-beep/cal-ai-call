import { router } from 'expo-router';
import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import ChangePasswordScreen from '../settings/change-password';
import HelpScreen from '../settings/help';
import PrivacyScreen from '../settings/privacy';
import TermsScreen from '../settings/terms';
import ProfileScreen from '../(tabs)/profile';
import WelcomeScreen from '../(onboarding)/welcome';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the settings screen', () => {
  it('is called Settings, because that is what it is', async () => {
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('offers help, data handling and terms', async () => {
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Help')).toBeTruthy();
    expect(screen.getByText('What FoodLens does with your data')).toBeTruthy();
    expect(screen.getByText('Terms of use')).toBeTruthy();
  });

  it('opens the data page', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<ProfileScreen />);

    await user.press(screen.getByText('What FoodLens does with your data'));
    expect(router.push).toHaveBeenCalledWith('/settings/privacy');
  });

  it('still offers appearance and the device-only data controls', async () => {
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Delete everything on this device')).toBeTruthy();
  });

  it('does not offer a password change with no account signed in', async () => {
    // Tests run with no Supabase configured, so there is no account.
    await renderWithProviders(<ProfileScreen />);
    expect(screen.queryByText('Change password')).toBeNull();
  });
});

describe('the data page', () => {
  it('states what leaves the device, and what does not', async () => {
    await renderWithProviders(<PrivacyScreen />);
    expect(screen.getByText('What leaves your phone')).toBeTruthy();
    expect(screen.getByText('What we do not do')).toBeTruthy();
    expect(screen.getByText(/No analytics, no tracking/)).toBeTruthy();
  });

  it('says the photo is discarded by default', async () => {
    await renderWithProviders(<PrivacyScreen />);
    expect(screen.getByText(/read and then discarded on the server/)).toBeTruthy();
  });

  it('admits it is not a reviewed policy', async () => {
    await renderWithProviders(<PrivacyScreen />);
    expect(
      screen.getByText('This is a plain-language description, not a filed policy'),
    ).toBeTruthy();
  });

  it('describes this build, where no backend is configured', async () => {
    await renderWithProviders(<PrivacyScreen />);
    expect(screen.getByText(/no account backend configured/)).toBeTruthy();
  });
});

describe('the terms page', () => {
  it('leads with what the app is not', async () => {
    await renderWithProviders(<TermsScreen />);
    expect(screen.getByText('It is not health advice')).toBeTruthy();
    expect(screen.getByText('The numbers are estimates')).toBeTruthy();
  });

  it('is labelled as an unreviewed draft rather than presented as binding', async () => {
    await renderWithProviders(<TermsScreen />);
    expect(
      screen.getByText('These terms are a draft and have not been reviewed'),
    ).toBeTruthy();
  });
});

describe('the help page', () => {
  it('answers the questions the app actually raises', async () => {
    await renderWithProviders(<HelpScreen />);
    expect(screen.getByText('Why are the numbers estimates?')).toBeTruthy();
    expect(screen.getByText('How do I get a better reading?')).toBeTruthy();
    expect(screen.getByText('Why does my daily ring look empty?')).toBeTruthy();
  });

  it('says there is no support contact, rather than showing a dead form', async () => {
    await renderWithProviders(<HelpScreen />);
    expect(screen.getByText('There is no support contact yet')).toBeTruthy();
  });
});

describe('changing a password', () => {
  it('refuses when no account is signed in, and says why', async () => {
    await renderWithProviders(<ChangePasswordScreen />);

    expect(screen.getByText('No account signed in')).toBeTruthy();
    expect(screen.getByText(/no account backend configured/)).toBeTruthy();
    // No form that could not possibly work.
    expect(screen.queryByLabelText('New password')).toBeNull();
  });

  it('offers a way back', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<ChangePasswordScreen />);

    await user.press(screen.getByRole('button', { name: 'Go back' }));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('the welcome screen', () => {
  it('says an account is not required, before asking for anything', async () => {
    await renderWithProviders(<WelcomeScreen />);

    expect(screen.getByText(/No account needed/)).toBeTruthy();
  });

  it('offers a way past the questions', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<WelcomeScreen />);

    await user.press(screen.getByRole('button', { name: 'Look around first' }));
    expect(router.push).toHaveBeenCalledWith('/(onboarding)/privacy');
  });

  it('is honest about estimates on the first screen, not later', async () => {
    await renderWithProviders(<WelcomeScreen />);

    expect(screen.getByText('Estimates, not measurements')).toBeTruthy();
  });
});
