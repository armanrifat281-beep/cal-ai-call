import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { logger } from '@/lib/logger';
import { getSupabaseClient } from '@/lib/supabase';
import type { AppError, Result } from '@/lib/result';

import {
  deleteAccount as deleteAccountRequest,
  requestPasswordReset as requestPasswordResetRequest,
  signInWithEmail,
  signOut as signOutRequest,
  signUpWithEmail,
  updatePassword as updatePasswordRequest,
  type SignUpOutcome,
} from './service';

/**
 * Authentication state for the whole app.
 *
 * `status` is explicit rather than inferred from `session === null`, because
 * "not signed in" and "there is no backend to sign in to" need different UI:
 * the first offers a sign-in form, the second explains device-only mode.
 */

export type AuthStatus =
  /** Still reading the stored session. */
  | 'loading'
  /** A valid session exists. */
  | 'signed_in'
  /** No session, but signing in is possible. */
  | 'signed_out'
  /** No Supabase project is configured in this build. */
  | 'unavailable';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Convenience: true when a real account is signed in. */
  isSignedIn: boolean;

  signUp: (email: string, password: string) => Promise<Result<SignUpOutcome>>;
  signIn: (email: string, password: string) => Promise<Result<Session>>;
  signOut: () => Promise<Result<void>>;
  requestPasswordReset: (email: string) => Promise<Result<void>>;
  updatePassword: (newPassword: string) => Promise<Result<void>>;
  deleteAccount: () => Promise<Result<void>>;
  /**
   * True once Supabase reports that this session came from a password-reset
   * link. The user holds a valid session at that point but has not chosen a
   * password yet, so the app sends them to set one.
   */
  passwordResetPending: boolean;
  /** Called once a new password has been set, or the user backs out. */
  clearPasswordReset: () => void;
  /** Set when the last background session check failed. */
  sessionError: AppError | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const client = getSupabaseClient();
  const [status, setStatus] = useState<AuthStatus>(
    client ? 'loading' : 'unavailable',
  );
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState<AppError | null>(null);
  const [passwordResetPending, setPasswordResetPending] = useState(false);

  useEffect(() => {
    // No client means no backend in this build, which the initial state
    // already reflects. There is nothing to subscribe to and nothing to set.
    if (!client) return;

    let cancelled = false;

    // Read the stored session first so the app does not flash a sign-in
    // screen at a user who is already signed in.
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          logger.warn('could not read the stored session', { code: error.code });
        }
        setSession(data.session);
        setStatus(data.session ? 'signed_in' : 'signed_out');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        logger.warn('reading the stored session threw', { cause: String(cause) });
        // Treat an unreadable session as signed out rather than hanging on
        // the loading state forever.
        setStatus('signed_out');
      });

    // From here on, Supabase is the source of truth: this fires on sign-in,
    // sign-out, token refresh and the password-recovery deep link.
    const { data: subscription } = client.auth.onAuthStateChange(
      (event, nextSession) => {
        if (cancelled) return;
        logger.debug('auth state changed', { event });

        /*
          `INITIAL_SESSION` is the subscription replaying what is already in
          storage, and it can arrive with a null session before the
          `getSession()` read above has finished. The read owns the initial
          state; acting on this event as well raced it, and reported
          "signed out" for a split second to a user who was signed in.

          That was harmless until the tabs started redirecting a signed-out
          user to the welcome screen - at which point the race threw people
          out of the app while they were using it.
        */
        if (event === 'INITIAL_SESSION') return;

        setSession(nextSession);
        setSessionError(null);

        /*
          Only an actual sign-out ends the session.

          Treating every event that arrives without one as a sign-out was too
          blunt: Supabase emits events with a null session while a refresh is
          in flight, and a momentary gap then evicted someone who was in the
          middle of using the app. A refresh token that is genuinely dead
          arrives as `SIGNED_OUT`, which is still handled here.

          If a session does go missing without that event, the app keeps
          believing it is signed in and the next request answers 401 - which
          the services already turn into "your session expired, sign in
          again". A wrong message is a far smaller fault than being thrown
          out of the app for a network hiccup.
        */
        if (nextSession) {
          setStatus('signed_in');
        } else if (event === 'SIGNED_OUT') {
          setStatus('signed_out');
        }

        // The one event that means "signed in, but not by choice": the user
        // followed a reset link and still needs to pick a password.
        if (event === 'PASSWORD_RECOVERY') setPasswordResetPending(true);
        if (event === 'SIGNED_OUT') setPasswordResetPending(false);
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [client]);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await signUpWithEmail(email, password);
    if (!result.ok) setSessionError(result.error);
    return result;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInWithEmail(email, password);
    if (!result.ok) setSessionError(result.error);
    // onAuthStateChange sets the session; doing it here too would race.
    return result;
  }, []);

  const signOut = useCallback(async () => {
    const result = await signOutRequest();
    // Clear locally regardless: the user asked to be signed out, and leaving
    // them apparently signed in after a failed network call is worse.
    setSession(null);
    setStatus(client ? 'signed_out' : 'unavailable');
    return result;
  }, [client]);

  const requestPasswordReset = useCallback(async (email: string) => {
    return requestPasswordResetRequest(email);
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const result = await updatePasswordRequest(newPassword);
    if (result.ok) setPasswordResetPending(false);
    return result;
  }, []);

  const clearPasswordReset = useCallback(() => setPasswordResetPending(false), []);

  const deleteAccount = useCallback(async () => {
    const result = await deleteAccountRequest();
    if (result.ok) {
      setSession(null);
      setStatus(client ? 'signed_out' : 'unavailable');
    }
    return result;
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      isSignedIn: status === 'signed_in' && session !== null,
      signUp,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      deleteAccount,
      passwordResetPending,
      clearPasswordReset,
      sessionError,
    }),
    [
      status,
      session,
      signUp,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      deleteAccount,
      passwordResetPending,
      clearPasswordReset,
      sessionError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
