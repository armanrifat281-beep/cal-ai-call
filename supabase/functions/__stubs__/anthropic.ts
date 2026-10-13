/**
 * Stands in for `npm:@anthropic-ai/sdk` under Jest.
 *
 * The Edge Function runs on Deno, where `npm:` specifiers resolve natively.
 * Node cannot resolve them, which kept `vision.ts` - the file that decides
 * whether a failed analysis is retried - out of the test suite entirely.
 *
 * Only the Gemini half of that file is exercised from Node, so this needs to
 * be constructible and nothing more. A test that reached for a real Anthropic
 * call would fail loudly here rather than quietly passing.
 */
export default class AnthropicStub {
  constructor(_options: unknown) {}

  readonly messages = {
    create(): never {
      throw new Error(
        'The Anthropic client is stubbed under Jest. Test the Gemini path, or mock this explicitly.',
      );
    },
  };
}
