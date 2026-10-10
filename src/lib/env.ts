/**
 * Client-side configuration.
 *
 * Only values that are safe to ship inside the app binary belong here.
 *
 * Supabase issues two kinds of client key, and both are designed to be public
 * because every table is protected by Row Level Security:
 *
 *   sb_publishable_...   the current format ("publishable key")
 *   eyJ... (a JWT)       the legacy format ("anon key")
 *
 * Either works. What must NEVER appear here is a secret key
 * (`sb_secret_...`) or a service role JWT: those bypass RLS entirely, and
 * anything in an EXPO_PUBLIC_ variable is inlined into the JavaScript bundle
 * where anyone who downloads the app can read it. `classifySupabaseKey` below
 * detects that mistake and the app refuses to start with such a key.
 *
 * Secrets for the AI and nutrition providers are never read here at all. They
 * live as Supabase Edge Function secrets and are only used server-side.
 */

function readPublic(name: string): string | undefined {
  // Expo inlines EXPO_PUBLIC_* at build time, so each lookup must be static.
  const raw =
    name === 'EXPO_PUBLIC_SUPABASE_URL'
      ? process.env.EXPO_PUBLIC_SUPABASE_URL
      : name === 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
        ? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        : name === 'EXPO_PUBLIC_SUPABASE_ANON_KEY'
          ? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
          : undefined;

  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** What kind of Supabase key a string appears to be. */
export type SupabaseKeyKind =
  /** `sb_publishable_...` - safe to ship. */
  | 'publishable'
  /** Legacy anon JWT - safe to ship. */
  | 'anon_jwt'
  /** `sb_secret_...` - MUST NOT ship. */
  | 'secret'
  /** A service_role JWT - MUST NOT ship. */
  | 'service_role_jwt'
  /** Not recognisable as a Supabase key. */
  | 'unknown';

/** Decodes a JWT payload without verifying it. Shape inspection only. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = parts[1];
  if (!payload) return null;

  try {
    // Base64url -> base64, then pad to a multiple of four.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = globalThis.atob(padded);
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Classifies a Supabase key so a privileged one can be rejected before it is
 * ever used. This inspects the key's own shape; it makes no network call.
 */
export function classifySupabaseKey(key: string | undefined): SupabaseKeyKind {
  if (!key) return 'unknown';
  const trimmed = key.trim();

  if (trimmed.startsWith('sb_secret_')) return 'secret';
  if (trimmed.startsWith('sb_publishable_')) return 'publishable';

  const payload = decodeJwtPayload(trimmed);
  if (payload) {
    const role = payload.role;
    if (role === 'service_role') return 'service_role_jwt';
    if (role === 'anon') return 'anon_jwt';
  }

  return 'unknown';
}

/** True for a key that is safe to ship inside the app. */
export function isPublicSupabaseKey(key: string | undefined): boolean {
  const kind = classifySupabaseKey(key);
  return kind === 'publishable' || kind === 'anon_jwt';
}

/** True when the value is a key that must never leave the server. */
export function isPrivilegedSupabaseKey(key: string | undefined): boolean {
  const kind = classifySupabaseKey(key);
  return kind === 'secret' || kind === 'service_role_jwt';
}

export function looksLikeHttpsUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const supabaseUrl = readPublic('EXPO_PUBLIC_SUPABASE_URL');

// The current variable name wins; the legacy one is still read so an existing
// .env keeps working.
const configuredKey =
  readPublic('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
  readPublic('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const keyKind = classifySupabaseKey(configuredKey);

/**
 * True only when the URL is a valid https URL AND the key is one that is safe
 * to ship. A privileged key leaves this false, so the app runs in device-only
 * mode rather than shipping a key that bypasses every security policy.
 */
export const isSupabaseConfigured: boolean =
  looksLikeHttpsUrl(supabaseUrl) && isPublicSupabaseKey(configuredKey);

export const env = {
  supabaseUrl,
  /** The publishable or anon key, only when it is safe to use. */
  supabaseKey: isPublicSupabaseKey(configuredKey) ? configuredKey : undefined,
  supabaseKeyKind: keyKind,
  isSupabaseConfigured,
  /** True in a development build (Metro); false in a release bundle. */
  isDev: __DEV__,
} as const;

/**
 * A short, human-readable list of what is wrong with the configuration.
 * Empty when everything needed is present and safe.
 */
export function describeMissingConfig(): string[] {
  const problems: string[] = [];

  if (!looksLikeHttpsUrl(supabaseUrl)) {
    problems.push('EXPO_PUBLIC_SUPABASE_URL (must be an https URL)');
  }

  if (!configuredKey) {
    problems.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  } else if (keyKind === 'secret' || keyKind === 'service_role_jwt') {
    problems.push(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a PRIVILEGED key, which has been ignored. ' +
        'Replace it with the publishable key and rotate the one you pasted: anything in an ' +
        'EXPO_PUBLIC_ variable is readable by anyone who downloads the app.',
    );
  } else if (keyKind === 'unknown') {
    problems.push(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not a recognisable Supabase key ' +
        '(expected sb_publishable_... or a legacy anon JWT)',
    );
  }

  return problems;
}
