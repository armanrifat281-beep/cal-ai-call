import * as Google from 'expo-auth-session/providers/google';
import { useCallback, useEffect, useRef, useState } from 'react';

import { env } from '@/lib/env';
import type { AppError } from '@/lib/result';

import { isProviderEnabled, providerNotConfigured } from './providerAvailability';
import { signInWithGoogleToken } from './socialService';

export interface GoogleSignIn {
  /** False when the client ids are missing, or the provider cannot start. */
  available: boolean;
  /** Opens Google's sheet. Resolves when the user finishes or cancels. */
  start: () => void;
  busy: boolean;
  error: AppError | null;
  clearError: () => void;
}

/**
 * Signing in with Google.
 *
 * Asks Google for an identity token rather than an access token, because
 * that is what Supabase can verify on its own. No client secret is involved
 * anywhere, which is what makes this safe to run in the app.
 *
 * The request is unavailable until the client ids are set, and the hook says
 * so rather than opening a browser that comes back with nothing.
 */
export function useGoogleSignIn(onSignedIn?: () => void): GoogleSignIn {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: env.googleIosClientId,
    androidClientId: env.googleAndroidClientId,
    // The audience Supabase verifies against, needed on every platform.
    clientId: env.googleWebClientId,
  });

  /**
   * Everything that can be decided the moment the response arrives is
   * decided here, during render, rather than from an effect. React
   * documents this for reacting to a changed input, and it avoids
   * committing a frame that still says "signing in" after the user has
   * already closed the sheet.
   */
  const [handled, setHandled] = useState<typeof response>(null);
  if (response !== handled) {
    setHandled(response);

    if (response && response.type !== 'success') {
      setBusy(false);
      if (response.type === 'error') {
        setError({
          code: 'provider_error',
          message: 'Signing in with Google did not work. Try again.',
          detail: response.error?.message,
          retryable: true,
        });
      }
    }

    if (response?.type === 'success' && !response.params.id_token) {
      setBusy(false);
      setError({
        code: 'provider_error',
        message: 'Google did not return a sign-in token.',
        detail: 'no id_token in the response',
        retryable: true,
      });
    }
  }

  const idToken =
    response?.type === 'success' ? response.params.id_token : undefined;

  // A token is worth one session. Remembering which one has been spent
  // stops a re-render from trying to spend it twice.
  const spent = useRef<string | null>(null);
  const onSignedInRef = useRef(onSignedIn);
  useEffect(() => {
    onSignedInRef.current = onSignedIn;
  });

  useEffect(() => {
    if (!idToken || spent.current === idToken) return;
    spent.current = idToken;

    void signInWithGoogleToken(idToken).then((result) => {
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.value) onSignedInRef.current?.();
    });
  }, [idToken]);

  const start = useCallback(() => {
    setError(null);
    setBusy(true);

    void (async () => {
      // Having the client ids says this side is ready; it says nothing about
      // whether the project accepts Google tokens. Asking first means the
      // user is not walked through Google's sheet only to be refused.
      if (!(await isProviderEnabled('google'))) {
        setBusy(false);
        setError(providerNotConfigured('google'));
        return;
      }
      await promptAsync().catch(() => setBusy(false));
    })();
  }, [promptAsync]);

  return {
    available: env.isGoogleSignInConfigured && request !== null,
    start,
    busy,
    error,
    clearError: useCallback(() => setError(null), []),
  };
}
