/**
 * The provider layer's failure handling.
 *
 * This is the file that decides whether a user sees a meal or an error, and
 * none of it was covered: a photo analysis that failed intermittently took a
 * long diagnosis partly because these branches were never exercised.
 *
 * Only the Gemini path is tested from Node. The Anthropic client is stubbed
 * (see `__stubs__/anthropic.ts`); its own retrying is the SDK's job.
 */
import { selectVisionProvider } from '../vision.ts';

const KEY = 'test-key-not-a-real-credential';

interface FakeEnv {
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_MODEL?: string;
}

function useEnv(env: FakeEnv): void {
  (globalThis as { Deno?: unknown }).Deno = {
    env: { get: (name: string) => env[name as keyof FakeEnv] },
  };
}

function reply(status: number, body: unknown): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, { status });
}

function answer(finishReason: string, text = '{"foods":[]}'): unknown {
  return {
    candidates: [{ finishReason, content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 },
  };
}

const REQUEST = {
  systemPrompt: 'Identify the food.',
  userPrompt: 'Analyse this.',
  imageBase64: 'AAAA',
  mimeType: 'image/jpeg',
  schema: { type: 'object' },
  maxTokens: 100,
  timeoutMs: 10_000,
};

function gemini() {
  const provider = selectVisionProvider(REQUEST.timeoutMs);
  if (provider === null) throw new Error('expected a provider');
  return provider;
}

describe('selectVisionProvider', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    useEnv({ GEMINI_API_KEY: KEY });
  });

  it('returns nothing when no key is configured, so the caller can say so', () => {
    useEnv({});
    expect(selectVisionProvider(1_000)).toBeNull();
  });

  it('prefers Anthropic when both keys are set, as the prompts were tuned for it', () => {
    useEnv({ GEMINI_API_KEY: KEY, ANTHROPIC_API_KEY: KEY });
    expect(gemini().label).not.toContain('gemini');
  });

  describe('the Gemini path', () => {
    it('reads a successful answer', async () => {
      fetchMock.mockImplementation(async () => reply(200, answer('STOP')));

      const result = await gemini().analyse(REQUEST);

      expect(result.text).toBe('{"foods":[]}');
      expect(result.refused).toBe(false);
      expect(result.truncated).toBe(false);
      expect(result.inputTokens).toBe(10);
    });

    it('reports a cut-off answer as truncated, not as unreadable', async () => {
      fetchMock.mockImplementation(async () => reply(200, answer('MAX_TOKENS', '{"foods":[{"na')));

      const result = await gemini().analyse(REQUEST);

      expect(result.truncated).toBe(true);
    });

    it('reports a safety stop as a refusal, which is not a fault', async () => {
      fetchMock.mockImplementation(async () => reply(200, answer('SAFETY', '')));

      const result = await gemini().analyse(REQUEST);

      expect(result.refused).toBe(true);
    });

    it('retries once when the model is momentarily unavailable', async () => {
      fetchMock
        .mockImplementationOnce(async () => reply(503, { error: { message: 'overloaded' } }))
        .mockImplementationOnce(async () => reply(200, answer('STOP')));

      const result = await gemini().analyse(REQUEST);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.text).toBe('{"foods":[]}');
    });

    it('gives up after the second attempt rather than retrying forever', async () => {
      fetchMock.mockImplementation(async () => reply(503, { error: { message: 'overloaded' } }));

      await expect(gemini().analyse(REQUEST)).rejects.toThrow('overloaded');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    /*
      A spent quota is not transient. Retrying it immediately would only
      spend the next second's quota too, and the caller already turns 429
      into "busy, try again in a minute".
    */
    it('does not retry a rate limit', async () => {
      fetchMock.mockImplementation(async () => reply(429, { error: { message: 'quota exhausted' } }));

      await expect(gemini().analyse(REQUEST)).rejects.toThrow('quota exhausted');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry a request the model rejected outright', async () => {
      fetchMock.mockImplementation(async () => reply(400, { error: { message: 'invalid argument' } }));

      await expect(gemini().analyse(REQUEST)).rejects.toThrow('invalid argument');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('carries the status, which is what decides the user-facing message', async () => {
      fetchMock.mockImplementation(async () => reply(429, { error: { message: 'quota exhausted' } }));

      await expect(gemini().analyse(REQUEST)).rejects.toMatchObject({ status: 429 });
    });

    /*
      An error from a gateway rather than from the model arrives as an HTML
      page. Calling `.json()` on that threw a bare SyntaxError, losing the
      status - the one piece that says whether retrying is worth anything.
    */
    it('survives an error page that is not JSON, and keeps its status', async () => {
      fetchMock
        .mockImplementationOnce(async () => reply(502, '<html><body>Bad Gateway</body></html>'))
        .mockImplementationOnce(async () => reply(200, answer('STOP')));

      const result = await gemini().analyse(REQUEST);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.text).toBe('{"foods":[]}');
    });

    it('explains a 200 that is not JSON instead of throwing a bare parse error', async () => {
      fetchMock.mockImplementation(async () => reply(200, '<html>nonsense</html>'));

      await expect(gemini().analyse(REQUEST)).rejects.toThrow(/nonsense/);
      // Nothing to retry against: the request was accepted.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  /*
    The model is a secret rather than a constant because the free daily
    allowance differs enormously between them - the plain Flash models ran
    out after twenty calls a day - and because Google retires names without
    warning. Changing it must not need a code change.
  */
  describe('which model answers', () => {
    it('uses the one the deployment configured', async () => {
      useEnv({ GEMINI_API_KEY: KEY, GEMINI_MODEL: 'gemini-2.5-flash-lite' });
      fetchMock.mockImplementation(async () => reply(200, answer('STOP')));

      const provider = gemini();
      await provider.analyse(REQUEST);

      expect(provider.label).toBe('gemini-2.5-flash-lite');
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-2.5-flash-lite');
    });

    it('falls back to a known model when nothing is configured', () => {
      useEnv({ GEMINI_API_KEY: KEY });

      expect(gemini().label).toContain('gemini');
    });

    it('ignores a blank setting rather than calling an empty model name', async () => {
      useEnv({ GEMINI_API_KEY: KEY, GEMINI_MODEL: '   ' });
      fetchMock.mockImplementation(async () => reply(200, answer('STOP')));

      await gemini().analyse(REQUEST);

      expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('models/:');
    });
  });
});
