import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';
import { usePreferencesStore } from '@/store/preferencesStore';

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
  /*
    Welcome, not sign-in. Opening on the form asked for an email address
    before anything had said what the app was or why an account was worth
    making; welcome says that in one sentence and offers both doors, so a
    returning user still reaches sign-in in one tap.
  */
  it('opens on welcome while signed out', async () => {
    await renderWithProviders(<BootGate />);
    expect(destination()).toBe('/(auth)/welcome');
  });

  it('opens on welcome even with no backend configured', async () => {
    // An earlier version skipped straight to onboarding here, which meant
    // the auth screens never appeared in the build anyone actually runs.
    usePreferencesStore.getState().completeOnboarding();
    await renderWithProviders(<BootGate />);
    expect(destination()).toBe('/(auth)/welcome');
  });
});

describe('the sign-in screen has no way around it', () => {
  it('offers no skip, even with no backend configured', async () => {
    await renderWithProviders(<SignInScreen />);

    expect(
      screen.queryByRole('button', { name: 'Continue without signing in' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /without an account/ }),
    ).toBeNull();
  });

  it('still says plainly why it cannot work yet', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByText('No account backend in this build.')).toBeTruthy();
  });
});
