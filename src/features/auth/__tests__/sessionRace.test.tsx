import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { getSupabaseClient } from '@/lib/supabase';

import { AuthProvider, useAuth } from '../AuthProvider';

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
  resetSupabaseClient: jest.fn(),
}));

const mockedClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

type Listener = (event: string, session: unknown) => void;

const SESSION = { access_token: 'a', user: { id: 'u1' } };

/**
 * A client whose stored-session read resolves only when the test says so.
 *
 * That delay is the whole point: it reproduces the window between
 * subscribing and the read finishing, which is where the bug lived.
 */
function clientWithSlowRestore() {
  let listener: Listener = () => {};
  let release: (() => void) | null = null;

  const restored = new Promise<void>((resolve) => {
    release = resolve;
  });

  const client = {
    auth: {
      getSession: async () => {
        await restored;
        return { data: { session: SESSION }, error: null };
      },
      onAuthStateChange: (next: Listener) => {
        listener = next;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
  };

  return {
    client,
    emit: (event: string, session: unknown) => listener(event, session),
    finishRestore: () => release?.(),
  };
}

function wrapper({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}

/**
 * The session race that threw people out of the app.
 *
 * Supabase replays `INITIAL_SESSION` as soon as the subscription is made,
 * and it can carry a null session before the stored one has been read back.
 * The provider treated that as "signed out".
 *
 * That was invisible until the tab layout started redirecting a signed-out
 * user to the welcome screen - and then a signed-in user tapping a tab was
 * bounced out of the app mid-use.
 */
describe('restoring a stored session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not report "signed out" while the stored session is still loading', async () => {
    const { client, emit, finishRestore } = clientWithSlowRestore();
    mockedClient.mockReturnValue(client as never);

    const { result } = await renderHook(() => useAuth(), { wrapper });

    // Supabase replays this immediately, before the read above resolves.
    await act(async () => {
      emit('INITIAL_SESSION', null);
    });

    // The user is signed in; the app must not decide otherwise from a replay.
    expect(result.current.status).not.toBe('signed_out');

    finishRestore();
    await waitFor(() => {
      expect(result.current.status).toBe('signed_in');
    });
  });

  /*
    The fix must not blunt the thing it was added for: a real sign-out has
    to still take effect, or the user stays inside an account they left.
  */
  it('still reports a genuine sign-out', async () => {
    const { client, emit, finishRestore } = clientWithSlowRestore();
    mockedClient.mockReturnValue(client as never);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    finishRestore();

    await waitFor(() => {
      expect(result.current.status).toBe('signed_in');
    });

    await act(async () => {
      emit('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('signed_out');
    });
  });

  /*
    A refresh in flight can arrive without a session for a moment. Treating
    that as a sign-out evicted people who were in the middle of using the
    app - the complaint this whole file exists for. A refresh token that is
    genuinely dead arrives as `SIGNED_OUT`, covered by the test above.
  */
  it('does not evict on a momentary gap during a token refresh', async () => {
    const { client, emit, finishRestore } = clientWithSlowRestore();
    mockedClient.mockReturnValue(client as never);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    finishRestore();

    await waitFor(() => {
      expect(result.current.status).toBe('signed_in');
    });

    await act(async () => {
      emit('TOKEN_REFRESHED', null);
    });

    expect(result.current.status).toBe('signed_in');
  });

  it('comes back cleanly when the refresh succeeds', async () => {
    const { client, emit, finishRestore } = clientWithSlowRestore();
    mockedClient.mockReturnValue(client as never);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    finishRestore();

    await waitFor(() => {
      expect(result.current.status).toBe('signed_in');
    });

    await act(async () => {
      emit('TOKEN_REFRESHED', null);
      emit('TOKEN_REFRESHED', SESSION);
    });

    expect(result.current.status).toBe('signed_in');
  });
});
