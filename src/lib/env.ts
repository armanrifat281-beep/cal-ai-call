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
          : name === 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
            ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
            : name === 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'
              ? process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
              : name === 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'
                ? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
                : undefined;

  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Values copied straight from `.env.example` without being filled in.
 *
 * `cp .env.example .env` and forgetting to paste the real values is the most
 * likely first mistake, and the placeholders are shaped like real values:
 * `sb_publishable_your_key_here` passes a prefix check, and
 * `https://your-project-ref.supabase.co` is a syntactically valid https URL.
 * Without this check the app would believe it was configured and fail with
 * confusing network errors instead of saying it is not set up.
 */
const PLACEHOLDER_MARKERS = [
  'your-project-ref',
  'your_key_here',
  'your-key-here',
  'your-anon-key',
  'YOUR_KEY',
  'changeme',
  'example.com',
];

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  const lowered = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lowered.includes(marker.toLowerCase()));
}

/** What kind of Supabase key a string appears to be. */
export type SupabaseKeyKind =
  /** `sb_publishable_...` - safe to ship. */
  | 'publishable'
  /** Still the placeholder from `.env.example`. */
  | 'placeholder'
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

  // Checked before the shape checks: a placeholder is shaped like the real
  // thing, and treating it as real is worse than treating it as absent.
  if (isPlaceholder(trimmed)) return 'placeholder';

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
  // An unfilled template URL parses perfectly well, so it is rejected here
  // rather than being allowed through to fail as a DNS error later.
  if (isPlaceholder(value)) return false;
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

/**
 * Google OAuth client ids.
 *
 * These are identifiers rather than secrets - Google publishes them in the
 * app bundle by design, and on their own they grant nothing. The web one is
 * the audience Supabase verifies the returned token against, so it is
 * required even on a phone.
 */
const googleIosClientId = readPublic('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
const googleAndroidClientId = readPublic('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');
const googleWebClientId = readPublic('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');

/**
 * Whether Google sign-in can be attempted at all.
 *
 * Needs the web client id, because that is the audience Supabase checks,
 * plus the platform one for whichever phone is running. Signing in with
 * Google also needs the provider enabled in the Supabase dashboard, which
 * no amount of client configuration can tell us about from here.
 */
export const isGoogleSignInConfigured: boolean =
  isSupabaseConfigured &&
  !isPlaceholder(googleWebClientId) &&
  googleWebClientId !== undefined &&
  (googleIosClientId !== undefined || googleAndroidClientId !== undefined);

/**
 * Whether Sign in with Apple can be attempted.
 *
 * False in every build today, and deliberately a flag rather than a
 * hard-coded `false` at the one call site: Apple's provider needs a paid
 * developer membership, an entitlement on the native target and the
 * provider switched on in the Supabase dashboard, none of which the app can
 * arrange for itself. When that work is done this becomes a real check and
 * the button appears on its own.
 */
export const isAppleSignInConfigured: boolean = false;

export const env = {
  supabaseUrl,
  googleIosClientId,
  googleAndroidClientId,
  googleWebClientId,
  isGoogleSignInConfigured,
  isAppleSignInConfigured,
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

  if (isPlaceholder(supabaseUrl)) {
    problems.push(
      'EXPO_PUBLIC_SUPABASE_URL is still the placeholder from .env.example. ' +
        'Paste your project URL.',
    );
  } else if (!looksLikeHttpsUrl(supabaseUrl)) {
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
  } else if (keyKind === 'placeholder') {
    problems.push(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is still the placeholder from ' +
        '.env.example. Paste the real publishable key from your project.',
    );
  } else if (keyKind === 'unknown') {
    problems.push(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not a recognisable Supabase key ' +
        '(expected sb_publishable_... or a legacy anon JWT)',
    );
  }

  return problems;
}
