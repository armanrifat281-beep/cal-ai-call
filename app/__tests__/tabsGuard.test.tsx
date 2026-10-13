import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useAuth } from '@/features/auth';
import { ok } from '@/lib/result';
import { renderWithProviders } from '@/test/renderWithProviders';

import ProfileScreen from '../(tabs)/profile';
import TabsLayout from '../(tabs)/_layout';

jest.mock('@/features/auth', () => {
  const actual = jest.requireActual('@/features/auth');
  return { ...actual, useAuth: jest.fn() };
});

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const signOut = jest.fn();

function signedIn(): void {
  mockedUseAuth.mockReturnValue({
    status: 'signed_in',
    session: { access_token: 'a' },
    user: { id: 'u1', email: 'someone@example.com' },
    isSignedIn: true,
    signOut,
    deleteAccount: jest.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

/** The mocked router renders `redirect-<href>`, so a redirect is assertable. */
function redirectedTo(): string | undefined {
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
  signOut.mockResolvedValue(ok(undefined));
  signedIn();
});

/**
 * Leaving the app is driven by the action, not by a watcher.
 *
 * The tab layout used to redirect to the welcome screen whenever the session
 * read as signed out. It stopped a sign-out leaving someone inside the app -
 * and then threw people out mid-use, because a layout guard re-runs on every
 * render and any momentary gap in the session looked identical to signing
 * out. From the phone that is indistinguishable from a crash.
 */
describe('signing out', () => {
  it('takes the user to welcome, because they asked to leave', async () => {
    await renderWithProviders(<ProfileScreen />);

    fireEvent.press(screen.getByText('Sign out'));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/(auth)/welcome');
    });
  });

  it('stays put when signing out fails, rather than pretending it worked', async () => {
    signOut.mockResolvedValue({
      ok: false,
      error: { code: 'network', message: 'Offline.', retryable: true },
    });

    await renderWithProviders(<ProfileScreen />);

    fireEvent.press(screen.getByText('Sign out'));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('the tab layout', () => {
  /*
    The regression this file exists for. Nothing about the session may move
    the user from here: a passive guard cannot tell a real sign-out from a
    token refresh that has not landed yet, and it fires on every render.
  */
  it('never redirects on its own, whatever the session is doing', async () => {
    await renderWithProviders(<TabsLayout />);
    expect(redirectedTo()).toBeUndefined();

    mockedUseAuth.mockReturnValue({
      status: 'signed_out',
      session: null,
      user: null,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useAuth>);

    await renderWithProviders(<TabsLayout />);
    expect(redirectedTo()).toBeUndefined();
  });
});
