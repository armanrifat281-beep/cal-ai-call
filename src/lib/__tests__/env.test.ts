import {
  classifySupabaseKey,
  isPrivilegedSupabaseKey,
  isPublicSupabaseKey,
  looksLikeHttpsUrl,
} from '../env';

/**
 * Builds an unsigned JWT with the given payload.
 *
 * Only the shape matters here: `classifySupabaseKey` inspects the payload to
 * spot a privileged key and never verifies the signature.
 */
function fakeJwt(payload: Record<string, unknown>): string {
  // btoa rather than Buffer: this project has no @types/node, and btoa is the
  // same primitive the implementation uses to decode.
  const encode = (value: object) =>
    globalThis
      .btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('classifySupabaseKey', () => {
  it('recognises a current publishable key', () => {
    expect(classifySupabaseKey('sb_publishable_AbCdEf123456')).toBe('publishable');
  });

  it('recognises a secret key, which must never ship', () => {
    expect(classifySupabaseKey('sb_secret_AbCdEf123456')).toBe('secret');
  });

  it('recognises a legacy anon JWT', () => {
    const key = fakeJwt({ iss: 'supabase', role: 'anon', ref: 'abcdefgh' });
    expect(classifySupabaseKey(key)).toBe('anon_jwt');
  });

  it('recognises a service role JWT, which must never ship', () => {
    const key = fakeJwt({ iss: 'supabase', role: 'service_role', ref: 'abcdefgh' });
    expect(classifySupabaseKey(key)).toBe('service_role_jwt');
  });

  it('reports anything else as unknown rather than assuming it is safe', () => {
    for (const value of [
      undefined,
      '',
      '   ',
      'not-a-key',
      'sb_something_else',
      'eyJbroken',
      fakeJwt({ role: 'authenticated' }),
      fakeJwt({}),
    ]) {
      expect(classifySupabaseKey(value)).toBe('unknown');
    }
  });

  it('tolerates surrounding whitespace, which .env files often carry', () => {
    expect(classifySupabaseKey('  sb_publishable_abc  ')).toBe('publishable');
    expect(classifySupabaseKey('  sb_secret_abc  ')).toBe('secret');
  });

  it('does not crash on a JWT whose payload is not valid base64 JSON', () => {
    expect(classifySupabaseKey('aaa.!!!not-base64!!!.ccc')).toBe('unknown');
  });
});

describe('isPublicSupabaseKey', () => {
  it('accepts exactly the two shippable key formats', () => {
    expect(isPublicSupabaseKey('sb_publishable_abc')).toBe(true);
    expect(isPublicSupabaseKey(fakeJwt({ role: 'anon' }))).toBe(true);
  });

  it('refuses privileged and unrecognised keys', () => {
    expect(isPublicSupabaseKey('sb_secret_abc')).toBe(false);
    expect(isPublicSupabaseKey(fakeJwt({ role: 'service_role' }))).toBe(false);
    expect(isPublicSupabaseKey('garbage')).toBe(false);
    expect(isPublicSupabaseKey(undefined)).toBe(false);
  });
});

describe('isPrivilegedSupabaseKey', () => {
  it('flags the two key formats that bypass row level security', () => {
    expect(isPrivilegedSupabaseKey('sb_secret_abc')).toBe(true);
    expect(isPrivilegedSupabaseKey(fakeJwt({ role: 'service_role' }))).toBe(true);
  });

  it('does not flag a shippable key', () => {
    expect(isPrivilegedSupabaseKey('sb_publishable_abc')).toBe(false);
    expect(isPrivilegedSupabaseKey(fakeJwt({ role: 'anon' }))).toBe(false);
  });

  it('does not flag an unknown value as privileged', () => {
    // Unknown is rejected for use, but it is not evidence of a leaked secret.
    expect(isPrivilegedSupabaseKey('garbage')).toBe(false);
  });
});

describe('looksLikeHttpsUrl', () => {
  it('accepts an https URL', () => {
    expect(looksLikeHttpsUrl('https://abcdefgh.supabase.co')).toBe(true);
  });

  it('rejects http, other schemes, and malformed values', () => {
    for (const value of [
      'http://abcdefgh.supabase.co',
      'abcdefgh.supabase.co',
      'ftp://example.com',
      'not a url',
      '',
      undefined,
    ]) {
      expect(looksLikeHttpsUrl(value)).toBe(false);
    }
  });
});
