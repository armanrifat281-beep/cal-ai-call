import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { logger } from './logger';

/**
 * Secure, chunked storage for the Supabase auth session.
 *
 * The session contains access and refresh tokens, so it belongs in the
 * keychain / Android Keystore rather than in AsyncStorage, which is plain
 * unencrypted storage readable on a rooted or jailbroken device.
 *
 * SecureStore on Android stores values in encrypted shared preferences and
 * warns (and can fail) above roughly 2 KB per entry. A Supabase session with a
 * JWT and user metadata routinely exceeds that, so values are split across
 * numbered entries and reassembled on read.
 *
 * Layout for a key `k` holding a value split into 3 parts:
 *
 *   k      -> "chunks:3"     (manifest)
 *   k.0    -> first part
 *   k.1    -> second part
 *   k.2    -> third part
 *
 * A short value is written straight to `k` with no manifest, so small entries
 * cost one read and older single-entry values keep working.
 */

/**
 * The three operations this module needs from whatever is storing entries.
 */
interface SessionBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/**
 * Web has no secure storage, so it gets ordinary browser storage.
 *
 * `expo-secure-store` is native-only and ships an empty web shim: every call
 * lands on an undefined function and throws
 * `ExpoSecureStore.default.getValueWithKeyAsync is not a function`, which
 * takes down sign-in before the request is even made. That is what made the
 * web build impossible to log into.
 *
 * `localStorage` is NOT secure storage. Anything on the page can read it,
 * which is precisely what the keychain exists to prevent - so this applies
 * to web and nowhere else. The web build is a development and review
 * surface; the shipped Android and iOS apps keep using the keychain and the
 * Android Keystore, unchanged.
 *
 * Every access is wrapped: storage can be absent or throw outright in a
 * private window or with site data blocked, and a failure there should read
 * as "not signed in" rather than crash the app.
 */
const browserBackend: SessionBackend = {
  async getItemAsync(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  async setItemAsync(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Quota or blocked storage. The session simply will not persist.
    }
  },
  async deleteItemAsync(key) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Nothing to remove, or storage is unavailable. Either is fine.
    }
  },
};

const backend: SessionBackend = Platform.OS === 'web' ? browserBackend : SecureStore;

/**
 * Bytes per chunk. Comfortably under Android's ~2048-byte threshold, with
 * headroom because the limit counts encrypted bytes, not characters.
 *
 * Kept on web too. The chunking is harmless there - a few extra keys - and
 * one code path that both platforms take is worth more than the handful of
 * writes it saves.
 */
export const CHUNK_SIZE = 1536;

const MANIFEST_PREFIX = 'chunks:';

/** Hard ceiling on parts, so a corrupt manifest cannot spin forever. */
const MAX_CHUNKS = 64;

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

/**
 * Reads one raw entry, normalizing anything that is not a string to null.
 *
 * The typings promise `string | null`, but a platform or a test double can
 * hand back `undefined`, and a crash inside the auth storage adapter would
 * take down sign-in rather than degrade to "not signed in".
 */
async function readRaw(key: string): Promise<string | null> {
  const value = await backend.getItemAsync(key);
  return typeof value === 'string' ? value : null;
}

function parseManifest(value: string): number | null {
  if (!value.startsWith(MANIFEST_PREFIX)) return null;
  const count = Number.parseInt(value.slice(MANIFEST_PREFIX.length), 10);
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) return null;
  return count;
}

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + CHUNK_SIZE));
  }
  return chunks;
}

/** Removes a key's chunks. Tolerates gaps left by an interrupted write. */
async function removeChunks(key: string, upTo: number): Promise<void> {
  const limit = Math.min(Math.max(upTo, 0), MAX_CHUNKS);
  for (let index = 0; index < limit; index += 1) {
    await backend.deleteItemAsync(chunkKey(key, index)).catch(() => {
      // Already absent. Nothing to do.
    });
  }
}

export async function getItem(key: string): Promise<string | null> {
  try {
    const head = await readRaw(key);
    if (head === null) return null;

    const count = parseManifest(head);
    if (count === null) {
      // A plain value written directly, or one stored before chunking existed.
      return head;
    }

    const parts: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const part = await readRaw(chunkKey(key, index));
      if (part === null) {
        // A missing part means the stored value is unusable. Returning a
        // truncated session would look like a valid but broken login, so the
        // remains are cleared and the user is simply signed out.
        logger.warn('secure session store: incomplete value, clearing', {
          missingIndex: index,
          expected: count,
        });
        await removeItem(key);
        return null;
      }
      parts.push(part);
    }

    return parts.join('');
  } catch (cause) {
    logger.warn('secure session store: read failed', { cause: String(cause) });
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    // Clear any previous chunks first: a shorter new value would otherwise
    // leave stale parts behind that a later manifest could pick up.
    const previous = await readRaw(key);
    const previousCount = previous === null ? null : parseManifest(previous);
    if (previousCount !== null) {
      await removeChunks(key, previousCount);
    }

    if (value.length <= CHUNK_SIZE) {
      await backend.setItemAsync(key, value);
      return;
    }

    const chunks = splitIntoChunks(value);
    if (chunks.length > MAX_CHUNKS) {
      throw new Error(
        `value needs ${chunks.length} chunks, more than the ${MAX_CHUNKS} allowed`,
      );
    }

    // Parts first, manifest last: if the write is interrupted, the manifest
    // never points at parts that were not written.
    for (const [index, chunk] of chunks.entries()) {
      await backend.setItemAsync(chunkKey(key, index), chunk);
    }
    await backend.setItemAsync(key, `${MANIFEST_PREFIX}${chunks.length}`);
  } catch (cause) {
    logger.warn('secure session store: write failed', { cause: String(cause) });
    // Rethrow: Supabase needs to know the session could not be persisted,
    // rather than believing the user will still be signed in next launch.
    throw cause instanceof Error ? cause : new Error(String(cause));
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    const head = await readRaw(key);
    const count = head === null ? null : parseManifest(head);
    if (count !== null) {
      await removeChunks(key, count);
    } else {
      // The count is unknown, so clear defensively: an earlier interrupted
      // write may have left parts with no manifest.
      await removeChunks(key, MAX_CHUNKS);
    }
    await backend.deleteItemAsync(key);
  } catch (cause) {
    logger.warn('secure session store: delete failed', { cause: String(cause) });
  }
}

/**
 * The storage adapter shape `supabase-js` expects.
 */
export const secureSessionStore = { getItem, setItem, removeItem };
