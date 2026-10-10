import * as SecureStore from 'expo-secure-store';

import { CHUNK_SIZE, getItem, removeItem, setItem } from '../secureSessionStore';

const KEY = 'sb-abcdefgh-auth-token';

/** A realistic Supabase session: comfortably larger than one chunk. */
function sessionJson(sizeBytes: number): string {
  const filler = 'x'.repeat(Math.max(0, sizeBytes - 60));
  return JSON.stringify({ access_token: filler, refresh_token: 'r'.repeat(40) });
}

async function storedKeys(): Promise<string[]> {
  // The mock in jest.setup.ts is backed by a Map; probe the keys we may have
  // written rather than reaching into its internals.
  const keys: string[] = [];
  if ((await SecureStore.getItemAsync(KEY)) !== null) keys.push(KEY);
  for (let index = 0; index < 70; index += 1) {
    if ((await SecureStore.getItemAsync(`${KEY}.${index}`)) !== null) {
      keys.push(`${KEY}.${index}`);
    }
  }
  return keys;
}

beforeEach(async () => {
  await removeItem(KEY);
  jest.clearAllMocks();
});

describe('small values', () => {
  it('round-trips a value that fits in one chunk', async () => {
    await setItem(KEY, 'small-session');
    expect(await getItem(KEY)).toBe('small-session');
  });

  it('writes a short value directly, with no manifest or chunks', async () => {
    await setItem(KEY, 'small-session');
    expect(await storedKeys()).toEqual([KEY]);
  });

  it('returns null for a key that was never written', async () => {
    expect(await getItem('never-written')).toBeNull();
  });

  it('round-trips a value of exactly one chunk', async () => {
    const exact = 'a'.repeat(CHUNK_SIZE);
    await setItem(KEY, exact);
    expect(await getItem(KEY)).toBe(exact);
    expect(await storedKeys()).toEqual([KEY]);
  });
});

describe('large values', () => {
  it('round-trips a value spanning several chunks', async () => {
    const session = sessionJson(CHUNK_SIZE * 3 + 200);
    await setItem(KEY, session);
    expect(await getItem(KEY)).toBe(session);
  });

  it('splits into a manifest plus numbered parts', async () => {
    await setItem(KEY, 'a'.repeat(CHUNK_SIZE * 2 + 1));
    const keys = await storedKeys();
    expect(keys).toEqual([KEY, `${KEY}.0`, `${KEY}.1`, `${KEY}.2`]);
    expect(await SecureStore.getItemAsync(KEY)).toBe('chunks:3');
  });

  it('keeps every chunk at or under the size limit', async () => {
    await setItem(KEY, 'a'.repeat(CHUNK_SIZE * 3 + 7));
    for (let index = 0; index < 4; index += 1) {
      const part = await SecureStore.getItemAsync(`${KEY}.${index}`);
      expect(part).not.toBeNull();
      expect((part ?? '').length).toBeLessThanOrEqual(CHUNK_SIZE);
    }
  });

  it('round-trips a value just past a chunk boundary', async () => {
    const value = 'b'.repeat(CHUNK_SIZE + 1);
    await setItem(KEY, value);
    expect(await getItem(KEY)).toBe(value);
  });
});

describe('overwriting', () => {
  it('leaves no stale chunks when a long value is replaced by a short one', async () => {
    await setItem(KEY, 'a'.repeat(CHUNK_SIZE * 4));
    await setItem(KEY, 'tiny');

    expect(await getItem(KEY)).toBe('tiny');
    expect(await storedKeys()).toEqual([KEY]);
  });

  it('shrinks the chunk count when a long value is replaced by a shorter long one', async () => {
    await setItem(KEY, 'a'.repeat(CHUNK_SIZE * 5));
    const shorter = 'b'.repeat(CHUNK_SIZE * 2);
    await setItem(KEY, shorter);

    expect(await getItem(KEY)).toBe(shorter);
    expect(await storedKeys()).toEqual([KEY, `${KEY}.0`, `${KEY}.1`]);
  });

  it('replaces a short value with a long one', async () => {
    await setItem(KEY, 'tiny');
    const long = 'c'.repeat(CHUNK_SIZE * 2 + 5);
    await setItem(KEY, long);
    expect(await getItem(KEY)).toBe(long);
  });
});

describe('removal', () => {
  it('removes a chunked value entirely', async () => {
    await setItem(KEY, 'a'.repeat(CHUNK_SIZE * 3));
    await removeItem(KEY);

    expect(await getItem(KEY)).toBeNull();
    expect(await storedKeys()).toEqual([]);
  });

  it('is safe to call for a key that does not exist', async () => {
    await expect(removeItem('never-written')).resolves.toBeUndefined();
  });

  it('clears orphaned chunks left with no manifest', async () => {
    // Simulates a write interrupted before the manifest was stored.
    await SecureStore.setItemAsync(`${KEY}.0`, 'orphan-a');
    await SecureStore.setItemAsync(`${KEY}.1`, 'orphan-b');

    await removeItem(KEY);
    expect(await storedKeys()).toEqual([]);
  });
});

describe('corruption', () => {
  it('signs the user out rather than returning a truncated session', async () => {
    await setItem(KEY, 'a'.repeat(CHUNK_SIZE * 3));
    // Lose a middle chunk, as a failed partial write would.
    await SecureStore.deleteItemAsync(`${KEY}.1`);

    expect(await getItem(KEY)).toBeNull();
    // And the unusable remains are cleared, not left to fail again.
    expect(await storedKeys()).toEqual([]);
  });

  it('treats a nonsensical manifest as a plain value instead of throwing', async () => {
    for (const manifest of ['chunks:0', 'chunks:-1', 'chunks:abc', 'chunks:999']) {
      await SecureStore.setItemAsync(KEY, manifest);
      expect(await getItem(KEY)).toBe(manifest);
    }
  });

  it('returns null instead of throwing when the keychain read fails', async () => {
    const spy = jest
      .spyOn(SecureStore, 'getItemAsync')
      .mockRejectedValueOnce(new Error('keychain unavailable'));

    expect(await getItem(KEY)).toBeNull();
    spy.mockRestore();
  });

  it('propagates a write failure so the caller knows the session is not saved', async () => {
    const spy = jest
      .spyOn(SecureStore, 'setItemAsync')
      .mockRejectedValueOnce(new Error('keychain full'));

    await expect(setItem(KEY, 'value')).rejects.toThrow('keychain full');
    spy.mockRestore();
  });
});
