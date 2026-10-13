import { screen } from '@testing-library/react-native';

import { useAuth, type AuthStatus } from '@/features/auth';
import { renderWithProviders } from '@/test/renderWithProviders';

import TabsLayout from '../(tabs)/_layout';

jest.mock('@/features/auth', () => {
  const actual = jest.requireActual('@/features/auth');
  return { ...actual, useAuth: jest.fn() };
});

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function signedWith(status: AuthStatus): void {
  mockedUseAuth.mockReturnValue({
    status,
    session: null,
    user: null,
    isSignedIn: status === 'signed_in',
  } as unknown as ReturnType<typeof useAuth>);
}

/** The mocked router renders `redirect-<href>`, so the target is assertable. */
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

/**
 * Leaving the app when the session does.
 *
 * The boot gate only runs at launch, so signing out from the Profile tab
 * left the user standing inside the app, looking at tabs belonging to an
 * account they no longer had. The same held for a session that expired while
 * they were using it.
 */
describe('the tabs are closed to a signed-out user', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a signed-out user back to welcome', async () => {
    signedWith('signed_out');

    await renderWithProviders(<TabsLayout />);

    expect(redirectedTo()).toBe('/(auth)/welcome');
  });

  it('leaves a signed-in user where they are', async () => {
    signedWith('signed_in');

    await renderWithProviders(<TabsLayout />);

    expect(redirectedTo()).toBeUndefined();
  });

  /*
    The stored session is read asynchronously at launch. Treating "not yet
    known" as "signed out" would throw a signed-in user out of their own app
    for the first frame, which is a worse bug than the one being fixed.
  */
  it('waits while the stored session is still being read', async () => {
    signedWith('loading');

    await renderWithProviders(<TabsLayout />);

    expect(redirectedTo()).toBeUndefined();
  });
});
