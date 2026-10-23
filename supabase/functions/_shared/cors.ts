/**
 * The CORS headers every function answers with.
 *
 * One copy, imported six times, because six copies is what broke this.
 * `src/lib/supabase.ts` sets a global `x-application-name` header on the
 * client so requests are identifiable in the logs; a browser then lists it
 * in the preflight, and any function whose allow-list had not been updated
 * refused the request before the handler ever ran. Native apps send no
 * preflight, so the failure only ever appeared on web - which is exactly
 * the kind of drift a shared constant prevents.
 *
 * `*` for the origin is deliberate: these functions authenticate with a
 * bearer token, never a cookie, so there is no browser-trust boundary for
 * an origin check to protect. Access is decided by the JWT inside the
 * request, which an attacker's page cannot obtain.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
