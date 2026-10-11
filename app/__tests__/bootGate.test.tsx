import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';
import { usePreferencesStore } from '@/store/preferencesStore';
import { router } from 'expo-router';

import SignInScreen from '../(auth)/sign-in';
import BootGate from '../index';

/**
 * Where the app opens.
 *
 * The mocked router renders a `redirect-<href>` view, so the destination is
 * assertable without a navigator.
 */
function destination(): string | undefined {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(walk);
    const element = value as { props?: Record<string, unknown>; children?: unknown };
    const testID = element.props?.testID;
    if (typeof testID === 'string' && testID.startsWith('redirect-')) {
      found.push(testID.replace('redirect-', ''));
    }
    if (element.children) walk(element.children);
  };
  walk(screen.toJSON());
  return found[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  usePreferencesStore.getState().reset();
});

describe('the boot gate', () => {
  it('opens on sign-in', async () => {
    await renderWithProviders(<BootGate />);
    expect(destination()).toBe('/(auth)/sign-in');
  });

  it('opens on sign-in even with no backend configured', async () => {
    // An earlier version skipped straight to onboarding here, which meant
    // the login screen never appeared in the build anyone actually runs.
    usePreferencesStore.getState().completeOnboarding();
    await renderWithProviders(<BootGate />);
    expect(destination()).toBe('/(auth)/sign-in');
  });
});

describe('getting past a sign-in that cannot work', () => {
  it('offers a way through only while there is no backend', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(
      screen.getByRole('button', { name: 'Continue without signing in' }),
    ).toBeTruthy();
  });

  it('leads to onboarding, so the questions still get asked', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<SignInScreen />);

    await user.press(
      screen.getByRole('button', { name: 'Continue without signing in' }),
    );
    expect(router.replace).toHaveBeenCalledWith('/(onboarding)/welcome');
  });
});
