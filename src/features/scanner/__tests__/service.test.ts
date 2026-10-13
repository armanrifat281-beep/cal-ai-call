import { File as FileSystemFile } from 'expo-file-system';

import { analyzeMealPhoto } from '../service';

/**
 * The shape the upload depends on.
 *
 * Expo's WinterCG `fetch` serialises FormData itself and accepts a string, a
 * Blob, or exactly this: something with `bytes()`, a name and a mime type.
 */
interface UploadablePart {
  bytes: () => Promise<Uint8Array>;
  name: string;
  type: string;
}

// Declared inside the factory: Jest hoists `jest.mock` above the file's own
// declarations, so a class defined out here would not exist yet.
jest.mock('expo-file-system', () => ({
  File: jest.fn((uri: string) => ({
    uri,
    name: 'meal.jpg',
    type: 'image/jpeg',
    bytes: () => Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff])),
  })),
}));

jest.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://project.supabase.co',
    supabaseKey: 'sb_publishable_test',
    isSupabaseConfigured: true,
  },
}));

const mockFetch = jest.fn();
const appendSpy = jest.spyOn(FormData.prototype, 'append');

const INPUT = {
  imageUri: 'file:///tmp/meal.jpg',
  mimeType: 'image/jpeg',
  localHour: 13,
  retainPhoto: false,
  accessToken: 'token-123',
  fallbackMealType: 'lunch' as const,
};

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/** The smallest response `parseMealAnalysis` will accept. */
const ANALYSIS = {
  foods: [
    {
      name: 'Rice',
      confidence: 'medium',
      estimatedNutrients: {
        caloriesKcal: 205,
        proteinG: 4,
        carbsG: 45,
        fatG: 0.4,
      },
    },
  ],
  suggestedTitle: 'Rice',
  suggestedMealType: 'lunch',
  providerLabel: 'Claude',
};

beforeEach(() => {
  mockFetch.mockReset();
  appendSpy.mockClear();
  (FileSystemFile as unknown as jest.Mock).mockClear();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

describe('analyzeMealPhoto', () => {
  describe('the photo part', () => {
    /*
      Asserted on what the code hands to FormData, not on what FormData
      hands back: Node's FormData stringifies anything that is not a Blob,
      so reading the part back here would test the test environment rather
      than the code.

      The defect this guards: the photo used to be appended as React
      Native's `{ uri, name, type }` descriptor. That is RN's own extension,
      and Expo's WinterCG fetch rejects it with "Unsupported FormDataPart
      implementation" - so every analysis failed, with nothing on screen to
      say why.
    */
    function appendedPhoto(): UploadablePart {
      const call = appendSpy.mock.calls.find(([field]) => field === 'photo');
      return call?.[1] as unknown as UploadablePart;
    }

    it('sends something the fetch implementation can serialise', async () => {
      mockFetch.mockResolvedValue(okResponse(ANALYSIS));

      await analyzeMealPhoto(INPUT);

      expect(typeof appendedPhoto()?.bytes).toBe('function');
    });

    it('never sends a bare uri descriptor', async () => {
      mockFetch.mockResolvedValue(okResponse(ANALYSIS));

      await analyzeMealPhoto(INPUT);

      const photo = appendedPhoto() as unknown as Record<string, unknown>;
      // A descriptor would carry a uri and no way to read the bytes.
      expect(typeof photo.bytes).toBe('function');
    });

    it('carries a filename, so the server sees a file and not a text field', async () => {
      mockFetch.mockResolvedValue(okResponse(ANALYSIS));

      await analyzeMealPhoto(INPUT);

      expect(appendedPhoto().name).toBe('meal.jpg');
      expect(appendedPhoto().type).toBe('image/jpeg');
    });

    it('reads the file the caller prepared, not some other path', async () => {
      mockFetch.mockResolvedValue(okResponse(ANALYSIS));

      await analyzeMealPhoto(INPUT);

      expect(FileSystemFile as unknown as jest.Mock).toHaveBeenCalledWith(
        'file:///tmp/meal.jpg',
      );
    });
  });

  describe('what else is sent', () => {
    it('includes the local hour and the retention choice, and nothing else', async () => {
      mockFetch.mockResolvedValue(okResponse(ANALYSIS));

      await analyzeMealPhoto(INPUT);

      const body = mockFetch.mock.calls[0]?.[1]?.body as FormData;

      expect(body.get('localHour')).toBe('13');
      expect(body.get('retainPhoto')).toBe('false');
      // No name, no email, no profile: the server gets the photo and the
      // two things it needs to interpret it.
      expect(body.get('regionHint')).toBeNull();
    });

    it('sends a region hint only when the user chose one', async () => {
      mockFetch.mockResolvedValue(okResponse(ANALYSIS));

      await analyzeMealPhoto({ ...INPUT, regionHint: 'IN' });

      const body = mockFetch.mock.calls[0]?.[1]?.body as FormData;
      expect(body.get('regionHint')).toBe('IN');
    });

    it('authenticates as the user, because the allowance is per account', async () => {
      mockFetch.mockResolvedValue(okResponse(ANALYSIS));

      await analyzeMealPhoto(INPUT);

      const headers = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer token-123');
    });
  });

  describe('a server that is not set up', () => {
    function notConfigured() {
      return {
        ok: false,
        status: 503,
        clone: () => ({
          json: async () => ({
            error: {
              code: 'not_configured',
              message: 'Photo analysis is not available right now.',
            },
          }),
        }),
      };
    }

    // 503 used to fall into the general 5xx branch and come out as "the
    // analysis service is having trouble, try again" - advice that sends the
    // user round a loop that cannot end, because nothing is wrong with the
    // service and retrying will never configure it.
    it('says it is not set up, rather than asking for a retry', async () => {
      mockFetch.mockResolvedValue(notConfigured());

      const result = await analyzeMealPhoto(INPUT);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('not_configured');
      expect(result.error.retryable).toBe(false);
    });

    it("prefers the server's own wording, which knows the reason", async () => {
      mockFetch.mockResolvedValue(notConfigured());

      const result = await analyzeMealPhoto(INPUT);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toBe('Photo analysis is not available right now.');
    });

    it('falls back to its own wording when the body is not ours', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        clone: () => ({ json: async () => 'gateway down' }),
      });

      const result = await analyzeMealPhoto(INPUT);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('not_configured');
      expect(result.error.message).toContain('not set up');
    });

    it('still treats a genuine 500 as worth retrying', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        clone: () => ({ json: async () => ({}) }),
      });

      const result = await analyzeMealPhoto(INPUT);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('provider_error');
      expect(result.error.retryable).toBe(true);
    });

    /*
      Two unrelated faults answer 502 - the model could not be reached, and
      the model's answer could not be read - and the app used to show one
      fixed sentence for both. That made them indistinguishable on the phone
      and in a bug report, which cost a long diagnosis once.
    */
    it("uses the server's reason for a 502, not one fixed sentence", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        clone: () => ({
          json: async () => ({
            error: {
              code: 'invalid_response',
              message: 'The analysis came back unreadable. Try again.',
            },
          }),
        }),
      });

      const result = await analyzeMealPhoto(INPUT);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toBe('The analysis came back unreadable. Try again.');
    });

    it("carries the server's code in the detail, so a report names the branch", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        clone: () => ({
          json: async () => ({
            error: { code: 'response_truncated', message: 'That photo had too much in it.' },
          }),
        }),
      });

      const result = await analyzeMealPhoto(INPUT);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.detail).toContain('response_truncated');
      expect(result.error.detail).toContain('502');
    });

    it('falls back to its own wording when a 502 carries no reason', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        clone: () => ({ json: async () => '<html>Bad Gateway</html>' }),
      });

      const result = await analyzeMealPhoto(INPUT);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('provider_error');
      expect(result.error.message).toContain('having trouble');
      expect(result.error.detail).toBe('HTTP 502');
    });
  });

  describe('refusals', () => {
    it('will not send a photo without a session', async () => {
      const result = await analyzeMealPhoto({ ...INPUT, accessToken: null });

      expect(result.ok).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('reports a failed request rather than throwing', async () => {
      mockFetch.mockRejectedValue(new Error('offline'));

      const result = await analyzeMealPhoto(INPUT);

      expect(result.ok).toBe(false);
    });
  });
});
