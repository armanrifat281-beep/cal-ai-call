/**
 * Client-side configuration.
 *
 * Only values that are safe to ship inside the app binary belong here. The
 * Supabase URL and anon key are designed to be public: they grant nothing on
 * their own because every table is protected by Row Level Security.
 *
 * Secrets for the AI and nutrition providers are NEVER read here. They live as
 * Supabase Edge Function secrets and are only used server-side.
 */

function readPublic(name: string): string | undefined {
  // Expo inlines EXPO_PUBLIC_* at build time, so this must be a static lookup.
  const raw = process.env[name];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const supabaseUrl = readPublic('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = readPublic('EXPO_PUBLIC_SUPABASE_ANON_KEY');

function looksLikeHttpsUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * True only when both Supabase values are present and the URL is a valid
 * https URL. When false the app runs in local-only mode and says so.
 */
export const isSupabaseConfigured: boolean =
  looksLikeHttpsUrl(supabaseUrl) && typeof supabaseAnonKey === 'string';

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  isSupabaseConfigured,
  /** True in a development build (Metro); false in a release bundle. */
  isDev: __DEV__,
} as const;

/** A short, human-readable list of what is not configured yet. */
export function describeMissingConfig(): string[] {
  const missing: string[] = [];
  if (!looksLikeHttpsUrl(supabaseUrl)) {
    missing.push('EXPO_PUBLIC_SUPABASE_URL (must be a https URL)');
  }
  if (!supabaseAnonKey) {
    missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  return missing;
}
