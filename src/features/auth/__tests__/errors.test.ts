import type { AuthError } from '@supabase/supabase-js';

import { mapAuthError, wordNetworkError } from '../errors';

/** Shaped like what supabase-js hands back, without needing its class. */
function authError(
  partial: { code?: string; status?: number; message?: string } = {},
): AuthError {
  return {
    name: 'AuthApiError',
    message: partial.message ?? 'something failed',
    code: partial.code,
    // `in` rather than `??`, so a test can ask for no status at all - which
    // is how a dropped connection arrives.
    status: 'status' in partial ? partial.status : 400,
  } as AuthError;
}

describe('mapAuthError', () => {
  it('never reveals whether an account exists', () => {
    const mapped = mapAuthError(authError({ code: 'invalid_credentials' }), 'signIn');

    expect(mapped.code).toBe('unauthorized');
    expect(mapped.message).toBe('That email and password do not match an account.');
    expect(mapped.retryable).toBe(false);
  });

  it('keeps the developer detail without putting it in front of the user', () => {
    const mapped = mapAuthError(
      authError({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
      'signIn',
    );

    expect(mapped.detail).toContain('signIn');
    expect(mapped.detail).toContain('Invalid login credentials');
    expect(mapped.message).not.toContain('Invalid login credentials');
  });

  describe('a provider nobody has set up', () => {
    // The two paths report it differently, and both used to come out as
    // advice for a problem the user does not have.
    it('reads the id-token path as unconfigured, not as a mystery', () => {
      const mapped = mapAuthError(
        authError({
          code: 'provider_disabled',
          message: 'Provider (issuer "https://accounts.google.com") is not enabled',
        }),
        'signInWithGoogle',
      );

      expect(mapped.code).toBe('not_configured');
      expect(mapped.message).toBe('That sign-in method is not set up yet.');
      expect(mapped.retryable).toBe(false);
    });

    it('reads the OAuth path the same way, despite the validation code', () => {
      const mapped = mapAuthError(
        authError({
          code: 'validation_failed',
          message: 'Unsupported provider: provider is not enabled',
        }),
        'signInWithGoogleWeb',
      );

      expect(mapped.code).toBe('not_configured');
      expect(mapped.message).toBe('That sign-in method is not set up yet.');
      expect(mapped.retryable).toBe(false);
    });

    it('still treats a real validation failure as one', () => {
      const mapped = mapAuthError(
        authError({ code: 'validation_failed', message: 'Unable to validate email address' }),
        'signUp',
      );

      expect(mapped.code).toBe('validation');
      expect(mapped.message).toBe('Check the details you entered.');
    });
  });

  describe('an address the server will not take', () => {
    // Supabase rejects example domains and disposable providers. Before this
    // was mapped it surfaced as "Something went wrong. Try again.", which
    // invites pressing the button again with the same address.
    it('says the address was not accepted, and does not offer a retry', () => {
      const mapped = mapAuthError(
        authError({
          code: 'email_address_invalid',
          message: 'Email address "a@example.com" is invalid',
        }),
        'signUp',
      );

      expect(mapped.code).toBe('validation');
      expect(mapped.message).toContain('not accepted');
      expect(mapped.retryable).toBe(false);
      // Never the address itself: the message is shown beside the field.
      expect(mapped.message).not.toContain('example.com');
    });

    it('distinguishes an address barred from this project', () => {
      const mapped = mapAuthError(
        authError({ code: 'email_address_not_authorized' }),
        'signUp',
      );

      expect(mapped.code).toBe('unauthorized');
      expect(mapped.retryable).toBe(false);
    });
  });

  it('reports email sign-in being off as configuration, not bad details', () => {
    const mapped = mapAuthError(authError({ code: 'email_provider_disabled' }), 'signIn');

    expect(mapped.code).toBe('not_configured');
    expect(mapped.retryable).toBe(false);
  });

  it('does not blame the details of a suspended account', () => {
    const mapped = mapAuthError(authError({ code: 'user_banned' }), 'signIn');

    expect(mapped.code).toBe('unauthorized');
    expect(mapped.message).toContain('suspended');
  });

  it('tells the user to confirm their address when that is what is missing', () => {
    const mapped = mapAuthError(authError({ code: 'email_not_confirmed' }), 'signIn');

    expect(mapped.code).toBe('unauthorized');
    expect(mapped.message).toContain('confirm your address');
  });

  it('marks a rate limit retryable, because waiting does fix it', () => {
    const mapped = mapAuthError(authError({ code: 'over_email_send_rate_limit' }), 'signUp');

    expect(mapped.code).toBe('rate_limited');
    expect(mapped.retryable).toBe(true);
  });

  describe('with no code to go on', () => {
    it('falls back to the status for a rate limit', () => {
      expect(mapAuthError(authError({ status: 429 }), 'signIn').code).toBe('rate_limited');
    });

    it('calls a server fault retryable', () => {
      const mapped = mapAuthError(authError({ status: 503 }), 'signIn');

      expect(mapped.code).toBe('provider_error');
      expect(mapped.retryable).toBe(true);
    });

    it('reads a missing status as a dropped connection', () => {
      const mapped = mapAuthError(authError({ status: undefined }), 'signIn');

      expect(mapped.code).toBe('network');
      expect(mapped.retryable).toBe(true);
    });

    /*
      The defect this guards.

      A deleted Supabase project and a phone with no signal both surface as
      a fetch with no status, and both used to say "No connection. Check
      your internet and try again." - which sent someone whose internet was
      perfectly fine to their Wi-Fi settings, over and over, for a fault
      only the project's owner could fix.
    */
    it('tells a dead backend address apart from a dropped connection', () => {
      const mapped = mapAuthError(
        authError({
          status: undefined,
          message:
            'fetch failed: java.net.UnknownHostException: Unable to resolve host "abc123.supabase.co": No address associated with hostname',
        }),
        'signUp',
      );

      expect(mapped.code).toBe('not_configured');
      // Retrying the same request cannot help: the name still will not resolve.
      expect(mapped.retryable).toBe(false);
      expect(mapped.message).toMatch(/could not be found/i);
      expect(mapped.message).not.toMatch(/check your internet/i);
    });

    it('still blames the network when the host resolved fine', () => {
      const mapped = mapAuthError(
        authError({ status: undefined, message: 'Network request failed' }),
        'signIn',
      );

      expect(mapped.code).toBe('network');
    });
  });
});

/**
 * Who to blame for a request that went nowhere.
 *
 * Android names the host it could not resolve and `mapAuthError` reads it.
 * A browser says "Failed to fetch" and nothing more - it is not allowed to
 * say more - so on web the only way to tell "your wifi is off" from "the
 * server is gone" is to ask the device whether it thinks it is online.
 */
describe('wording a network failure', () => {
  const networkError = {
    code: 'network' as const,
    message: 'No connection. Check your internet and try again.',
    retryable: true,
  };

  it('keeps blaming the connection when the device really is offline', () => {
    expect(wordNetworkError(networkError, true)).toBe(networkError);
  });

  it('stops blaming the connection when the device says it is online', () => {
    const worded = wordNetworkError(networkError, false);

    expect(worded.message).toMatch(/could not reach the server/i);
    expect(worded.message).not.toMatch(/check your internet/i);
    // Pressing it again is what the user has already been doing.
    expect(worded.retryable).toBe(false);
  });

  it('leaves every other kind of failure exactly as it was', () => {
    const wrongPassword = {
      code: 'unauthorized' as const,
      message: 'That did not work. Check your details.',
      retryable: false,
    };

    expect(wordNetworkError(wrongPassword, false)).toBe(wrongPassword);
  });
});
