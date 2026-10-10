import { router } from 'expo-router';
import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { exchangeCodeForSession } from '@/features/auth';
import { appError, err, ok } from '@/lib/result';
import { renderWithProviders } from '@/test/renderWithProviders';

import AuthCallbackScreen from '../(auth)/auth-callback';

jest.mock('@/features/auth', () => {
  const actual = jest.requireActual('@/features/auth');
  return { ...actual, exchangeCodeForSession: jest.fn() };
});

const mockedExchange = exchangeCodeForSession as jest.MockedFunction<
  typeof exchangeCodeForSession
>;

const routerMock = jest.requireMock('expo-router') as {
  __setSearchParams: (next: Record<string, string>) => void;
};

/** A session is only inspected for existence here. */
const SESSION = { access_token: 'a', user: { id: 'u1' } } as never;

beforeEach(() => {
  jest.clearAllMocks();
  routerMock.__setSearchParams({});
  mockedExchange.mockResolvedValue(ok(SESSION));
});

/**
 * The link that comes back from a confirmation or reset email.
 *
 * Both are sent with `foodlens://auth-callback` as their redirect. Before
 * this route existed they landed on an unmatched route, so these cover the
 * paths that were previously dead ends.
 */
describe('the email callback', () => {
  it('spends the code for a session', async () => {
    routerMock.__setSearchParams({ code: 'abc123' });
    await renderWithProviders(<AuthCallbackScreen />);

    await waitFor(() => expect(mockedExchange).toHaveBeenCalledWith('abc123'));
  });

  it('spends the code once, however many times it renders', async () => {
    routerMock.__setSearchParams({ code: 'abc123' });
    const view = await renderWithProviders(<AuthCallbackScreen />);

    await waitFor(() => expect(mockedExchange).toHaveBeenCalled());
    await view.rerender(<AuthCallbackScreen />);
    await view.rerender(<AuthCallbackScreen />);

    // The code is worth exactly one session; spending it twice fails.
    expect(mockedExchange).toHaveBeenCalledTimes(1);
  });

  it('sends a confirmed address into the app', async () => {
    routerMock.__setSearchParams({ code: 'abc123', type: 'signup' });
    await renderWithProviders(<AuthCallbackScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'));
  });

  it('sends a reset link to the new-password screen, not into the app', async () => {
    routerMock.__setSearchParams({ code: 'abc123', type: 'recovery' });
    await renderWithProviders(<AuthCallbackScreen />);

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/(auth)/reset-password'),
    );
    expect(router.replace).not.toHaveBeenCalledWith('/(tabs)');
  });

  it('explains an expired link rather than failing silently', async () => {
    routerMock.__setSearchParams({ code: 'stale' });
    mockedExchange.mockResolvedValue(
      err(appError('unauthorized', 'That link has expired. Ask for a new one.', {
        retryable: false,
      })),
    );

    await renderWithProviders(<AuthCallbackScreen />);

    await waitFor(() => expect(screen.getByText('That link did not work')).toBeTruthy());
    expect(screen.getByText('That link has expired. Ask for a new one.')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('offers a way to get a fresh link', async () => {
    routerMock.__setSearchParams({ code: 'stale' });
    mockedExchange.mockResolvedValue(
      err(appError('unauthorized', 'Expired.', { retryable: false })),
    );
    const user = userEvent.setup();
    await renderWithProviders(<AuthCallbackScreen />);

    await waitFor(() => expect(screen.getByText('That link did not work')).toBeTruthy());
    await user.press(screen.getByRole('button', { name: 'Send a new reset email' }));
    expect(router.replace).toHaveBeenCalledWith('/(auth)/forgot-password');
  });

  it('surfaces a refusal reported in the link itself', async () => {
    routerMock.__setSearchParams({
      error: 'access_denied',
      error_description: 'Email+link+is+invalid+or+has+expired',
    });
    await renderWithProviders(<AuthCallbackScreen />);

    await waitFor(() =>
      expect(screen.getByText('Email link is invalid or has expired')).toBeTruthy(),
    );
    // Nothing to exchange, so nothing was attempted.
    expect(mockedExchange).not.toHaveBeenCalled();
  });

  it('says so when the link carries no code at all', async () => {
    routerMock.__setSearchParams({});
    await renderWithProviders(<AuthCallbackScreen />);

    await waitFor(() =>
      expect(screen.getByText(/That link is incomplete/)).toBeTruthy(),
    );
    expect(mockedExchange).not.toHaveBeenCalled();
  });

  it('shows progress while the exchange is in flight', async () => {
    routerMock.__setSearchParams({ code: 'abc123' });
    mockedExchange.mockReturnValue(new Promise(() => {}));

    await renderWithProviders(<AuthCallbackScreen />);
    expect(screen.getByText('Finishing up…')).toBeTruthy();
  });
});
