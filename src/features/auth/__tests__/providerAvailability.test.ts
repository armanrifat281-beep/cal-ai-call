import {
  isProviderEnabled,
  providerNotConfigured,
  resetProviderAvailability,
} from '../providerAvailability';

jest.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://project.supabase.co',
    supabaseKey: 'sb_publishable_test',
  },
}));

const mockFetch = jest.fn();

beforeEach(() => {
  resetProviderAvailability();
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

/** A settings response listing which providers are switched on. */
function settings(external: Record<string, boolean>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ external }),
  };
}

describe('isProviderEnabled', () => {
  it('reports a provider the project has switched on', async () => {
    mockFetch.mockResolvedValue(settings({ google: true }));

    await expect(isProviderEnabled('google')).resolves.toBe(true);
  });

  it('reports a provider the project has switched off', async () => {
    mockFetch.mockResolvedValue(settings({ google: false }));

    await expect(isProviderEnabled('google')).resolves.toBe(false);
  });

  it('asks the project rather than guessing from the key', async () => {
    mockFetch.mockResolvedValue(settings({ google: true }));

    await isProviderEnabled('google');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://project.supabase.co/auth/v1/settings',
      { headers: { apikey: 'sb_publishable_test' } },
    );
  });

  it('answers twice from one request, so a second press costs nothing', async () => {
    mockFetch.mockResolvedValue(settings({ google: true }));

    await isProviderEnabled('google');
    await isProviderEnabled('google');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('treats a provider the response does not mention as off', async () => {
    mockFetch.mockResolvedValue(settings({}));

    await expect(isProviderEnabled('google')).resolves.toBe(false);
  });

  describe('when the lookup fails', () => {
    // Guessing "off" here would hide a button that works, so the guess goes
    // the other way and the sign-in call reports the real problem.
    it('assumes the provider works rather than disabling it', async () => {
      mockFetch.mockRejectedValue(new Error('offline'));

      await expect(isProviderEnabled('google')).resolves.toBe(true);
    });

    it('treats a non-OK response the same way', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

      await expect(isProviderEnabled('google')).resolves.toBe(true);
    });

    it('does not cache the failure, so a flaky network recovers', async () => {
      mockFetch.mockRejectedValueOnce(new Error('offline'));
      mockFetch.mockResolvedValueOnce(settings({ google: false }));

      await expect(isProviderEnabled('google')).resolves.toBe(true);
      await expect(isProviderEnabled('google')).resolves.toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe('providerNotConfigured', () => {
  it('names the way in that does work instead of asking for a retry', () => {
    const error = providerNotConfigured('google');

    expect(error.code).toBe('not_configured');
    expect(error.message).toContain('Google');
    expect(error.message).toContain('email and password');
    expect(error.retryable).toBe(false);
  });

  it('capitalises the name rather than showing the lowercase key', () => {
    expect(providerNotConfigured('google').message).not.toContain('google');
  });
});
