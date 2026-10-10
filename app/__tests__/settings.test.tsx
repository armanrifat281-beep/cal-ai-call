import { router } from 'expo-router';
import { screen, userEvent } from '@testing-library/react-native';

import { usePreferencesStore } from '@/store/preferencesStore';
import { renderWithProviders } from '@/test/renderWithProviders';

import ChangePasswordScreen from '../settings/change-password';
import HelpScreen from '../settings/help';
import PrivacyScreen from '../settings/privacy';
import TermsScreen from '../settings/terms';
import HomeScreen from '../(tabs)/index';
import ProfileScreen from '../(tabs)/profile';
import EditProfileScreen from '../settings/profile';
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

describe('your profile', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
  });

  it('offers to add a name when there is none', async () => {
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Add your name')).toBeTruthy();
    expect(screen.getByText('So Home can greet you by name')).toBeTruthy();
  });

  it('shows the name once it is set', async () => {
    usePreferencesStore.getState().setPreferences({ displayName: 'Yeasin' });
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Yeasin')).toBeTruthy();
  });

  it('saves a name, trimmed', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<EditProfileScreen />);

    await user.type(screen.getByLabelText('What should we call you?'), '  Yeasin  ');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(usePreferencesStore.getState().preferences.displayName).toBe('Yeasin');
  });

  it('cannot be saved until something changes', async () => {
    usePreferencesStore.getState().setPreferences({ displayName: 'Yeasin' });
    await renderWithProviders(<EditProfileScreen />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('says where the data lives when there is no account', async () => {
    await renderWithProviders(<EditProfileScreen />);
    expect(screen.getByText('No account')).toBeTruthy();
    expect(screen.getByText('Everything is saved on this device only')).toBeTruthy();
  });

  it('does not offer a password change without an account', async () => {
    await renderWithProviders(<EditProfileScreen />);
    expect(screen.queryByText('Change password')).toBeNull();
  });

  it('is clear that the name does not leave the device', async () => {
    await renderWithProviders(<EditProfileScreen />);
    expect(screen.getByText('Your name stays on this device')).toBeTruthy();
  });
});

describe('the home greeting', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
  });

  it('greets by part of day before a name is set', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.getByText(/^Good (morning|afternoon|evening)$/)).toBeTruthy();
  });

  it('uses the name once there is one', async () => {
    usePreferencesStore.getState().setPreferences({ displayName: 'Yeasin' });
    await renderWithProviders(<HomeScreen />);
    expect(screen.getByText(/^Good (morning|afternoon|evening), Yeasin$/)).toBeTruthy();
  });

  it('still says which day it is', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.getByText(/^Today · /)).toBeTruthy();
  });
});
