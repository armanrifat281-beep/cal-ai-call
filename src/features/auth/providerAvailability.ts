import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { appError, type AppError } from '@/lib/result';

/** The third-party providers this app offers. */
export type SocialProvider = 'google';

/**
 * Whether a provider is switched on for this Supabase project.
 *
 * The app cannot work this out on its own: the client ids in `.env` only
 * cover this side of the handshake, and a project with Google switched off
 * still happily hands out a sign-in URL - it rejects the token at the very
 * end. Without this check the user is walked all the way through Google's
 * sheet and only then refused, so the check happens before the sheet rather
 * than after it.
 *
 * The answer comes from the project's own settings endpoint, which is public
 * - it is what tells any client which sign-in methods to offer - and carries
 * no account data.
 */
const SETTINGS_PATH = '/auth/v1/settings';

interface AuthSettings {
  external?: Record<string, unknown>;
}

/**
 * Cached for the life of the process, so pressing a button twice costs one
 * request. A provider switched on in the dashboard appears on the next
 * launch, which is soon enough for a setting that changes once.
 */
let inFlight: Promise<ReadonlySet<SocialProvider>> | null = null;

async function fetchEnabledProviders(): Promise<ReadonlySet<SocialProvider>> {
  const { supabaseUrl, supabaseKey } = env;
  if (!supabaseUrl || !supabaseKey) return new Set();

  const response = await fetch(`${supabaseUrl}${SETTINGS_PATH}`, {
    headers: { apikey: supabaseKey },
  });
  if (!response.ok) {
    throw new Error(`${SETTINGS_PATH} returned ${response.status}`);
  }

  const body = (await response.json()) as AuthSettings;
  const external = body.external ?? {};
  const enabled = new Set<SocialProvider>();
  for (const provider of ['google'] as const) {
    if (external[provider] === true) enabled.add(provider);
  }
  return enabled;
}

export async function isProviderEnabled(
  provider: SocialProvider,
): Promise<boolean> {
  inFlight ??= fetchEnabledProviders();

  try {
    return (await inFlight).has(provider);
  } catch (cause) {
    // A failed lookup is not cached, and is answered optimistically: a flaky
    // network must not disable a button that works. The sign-in call that
    // follows reports the real problem, including a disabled provider, so
    // nothing is swallowed by guessing wrong here.
    inFlight = null;
    logger.warn('could not read auth settings', { cause: String(cause) });
    return true;
  }
}

/** Forgets the cached answer. For tests, and for a signed-out reset. */
export function resetProviderAvailability(): void {
  inFlight = null;
}

/**
 * The error for a provider the project has not set up.
 *
 * There is nothing for the user to retry or correct, so it names the way in
 * that does work rather than asking them to try again.
 */
export function providerNotConfigured(provider: SocialProvider): AppError {
  const label = provider === 'google' ? 'Google' : provider;
  return appError(
    'not_configured',
    `Signing in with ${label} is not set up yet. Use your email and password instead.`,
    {
      detail: `the ${provider} provider is disabled on the Supabase project`,
      retryable: false,
    },
  );
}
