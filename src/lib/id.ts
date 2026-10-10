import * as Crypto from 'expo-crypto';

/**
 * Identifier generation.
 *
 * Ids are generated on the client so an entry can be created, rendered and
 * edited offline before it ever reaches the server. UUID v4 keeps collisions
 * irrelevant, and Postgres stores them natively as `uuid`.
 */
export function newId(): string {
  return Crypto.randomUUID();
}
