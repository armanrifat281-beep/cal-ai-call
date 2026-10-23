import { getSupabaseClient } from '@/lib/supabase';

import { forgetStoredMealPhotos } from '../storedPhotos';

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
  resetSupabaseClient: jest.fn(),
}));

const mockedClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

const USER = 'u1';

interface Options {
  files?: { name: string; id: string | null }[];
  listError?: string;
  removeError?: string;
  /** Fewer back than asked for: some object survived. */
  removeReturns?: number;
  updateError?: string;
  signedIn?: boolean;
}

function client(options: Options = {}) {
  const files = options.files ?? [];
  const calls = { list: 0, remove: 0, update: 0, removedPaths: [] as string[] };

  const from = jest.fn(() => ({
    update: () => {
      calls.update += 1;
      const chain = {
        eq: () => chain,
        not: () => chain,
        select: async () =>
          options.updateError
            ? { data: null, error: { message: options.updateError } }
            : { data: files.map((_, i) => ({ id: `e${i}` })), error: null },
      };
      return chain;
    },
  }));

  const value = {
    auth: {
      getUser: async () => ({
        data: { user: options.signedIn === false ? null : { id: USER } },
      }),
    },
    storage: {
      from: () => ({
        list: async (_prefix: string, opts: { offset: number }) => {
          calls.list += 1;
          if (options.listError) return { data: null, error: { message: options.listError } };
          return { data: opts.offset === 0 ? files : [], error: null };
        },
        remove: async (paths: string[]) => {
          calls.remove += 1;
          calls.removedPaths = paths;
          if (options.removeError) {
            return { data: null, error: { message: options.removeError } };
          }
          const count = options.removeReturns ?? paths.length;
          return { data: paths.slice(0, count).map((p) => ({ name: p })), error: null };
        },
      }),
    },
    from,
  };

  return { value, calls };
}

const twoFiles = [
  { name: 'a.jpg', id: 'f1' },
  { name: 'b.jpg', id: 'f2' },
];

afterEach(() => jest.clearAllMocks());

describe('forgetStoredMealPhotos', () => {
  it('removes the stored photos and clears the paths that pointed at them', async () => {
    const { value, calls } = client({ files: twoFiles });
    mockedClient.mockReturnValue(value as never);

    const result = await forgetStoredMealPhotos();

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.removed).toBe(2);
    expect(calls.removedPaths).toEqual([`${USER}/a.jpg`, `${USER}/b.jpg`]);
    expect(calls.update).toBe(1);
  });

  it('succeeds with nothing to do when no photo was ever stored', async () => {
    const { value, calls } = client({ files: [] });
    mockedClient.mockReturnValue(value as never);

    const result = await forgetStoredMealPhotos();

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.removed).toBe(0);
    // Nothing to remove, so nothing is asked of storage.
    expect(calls.remove).toBe(0);
  });

  it('treats a local-only user as nothing to delete, not as a failure', async () => {
    mockedClient.mockReturnValue(null as never);
    const noAccount = await forgetStoredMealPhotos();
    expect(noAccount.ok).toBe(true);

    const { value } = client({ signedIn: false });
    mockedClient.mockReturnValue(value as never);
    const signedOut = await forgetStoredMealPhotos();
    expect(signedOut.ok).toBe(true);
  });

  it('fails, and clears no reference, when storage refuses the delete', async () => {
    const { value, calls } = client({ files: twoFiles, removeError: 'not authorized' });
    mockedClient.mockReturnValue(value as never);

    const result = await forgetStoredMealPhotos();

    expect(result.ok).toBe(false);
    // A path must not be cleared while the photo it points at is still there.
    expect(calls.update).toBe(0);
  });

  it('fails when only some objects were removed, and says how many', async () => {
    const { value } = client({ files: twoFiles, removeReturns: 1 });
    mockedClient.mockReturnValue(value as never);

    const result = await forgetStoredMealPhotos();

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain('1 of 2');
  });

  it('fails when the listing cannot be read', async () => {
    const { value, calls } = client({ listError: 'not authorized' });
    mockedClient.mockReturnValue(value as never);

    const result = await forgetStoredMealPhotos();

    expect(result.ok).toBe(false);
    expect(calls.remove).toBe(0);
  });

  it('fails when the photos went but the references could not be cleared', async () => {
    const { value } = client({ files: twoFiles, updateError: 'not authorized' });
    mockedClient.mockReturnValue(value as never);

    const result = await forgetStoredMealPhotos();

    expect(result.ok).toBe(false);
  });

  it("only ever touches this account's own folder", async () => {
    const { value, calls } = client({ files: twoFiles });
    mockedClient.mockReturnValue(value as never);

    await forgetStoredMealPhotos();

    expect(calls.removedPaths.every((path) => path.startsWith(`${USER}/`))).toBe(true);
  });
});
