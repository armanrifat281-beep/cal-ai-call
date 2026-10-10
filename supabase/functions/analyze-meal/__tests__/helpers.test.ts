import {
  buildUserPrompt,
  detectImageType,
  extensionFor,
  fallbackMealType,
  parseHour,
  parseRegionHint,
  toBase64,
} from '../helpers';

/** Builds a buffer that starts with the given signature bytes. */
function withSignature(signature: number[], totalLength = 32): Uint8Array {
  const bytes = new Uint8Array(totalLength);
  signature.forEach((byte, index) => {
    bytes[index] = byte;
  });
  return bytes;
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function webpBytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  // "RIFF" + 4 size bytes + "WEBP"
  [0x52, 0x49, 0x46, 0x46].forEach((b, i) => (bytes[i] = b));
  [0x00, 0x00, 0x10, 0x00].forEach((b, i) => (bytes[i + 4] = b));
  [0x57, 0x45, 0x42, 0x50].forEach((b, i) => (bytes[i + 8] = b));
  return bytes;
}

describe('detectImageType', () => {
  it('identifies the three formats we accept from their magic bytes', () => {
    expect(detectImageType(withSignature(JPEG))).toBe('image/jpeg');
    expect(detectImageType(withSignature(PNG))).toBe('image/png');
    expect(detectImageType(webpBytes())).toBe('image/webp');
  });

  it('rejects a file that merely claims to be an image', () => {
    // An SVG: a real image to a browser, not something to forward to a model.
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(detectImageType(svg)).toBeNull();
  });

  it('rejects other formats and executables', () => {
    // GIF87a
    expect(detectImageType(withSignature([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]))).toBeNull();
    // PDF
    expect(detectImageType(withSignature([0x25, 0x50, 0x44, 0x46]))).toBeNull();
    // ELF
    expect(detectImageType(withSignature([0x7f, 0x45, 0x4c, 0x46]))).toBeNull();
    // Mach-O
    expect(detectImageType(withSignature([0xcf, 0xfa, 0xed, 0xfe]))).toBeNull();
    // ZIP (also a .docx or .apk)
    expect(detectImageType(withSignature([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
  });

  it('rejects a buffer too short to carry any signature', () => {
    expect(detectImageType(new Uint8Array(0))).toBeNull();
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
  });

  it('rejects a RIFF container that is not WebP', () => {
    const wav = new Uint8Array(32);
    [0x52, 0x49, 0x46, 0x46].forEach((b, i) => (wav[i] = b));
    // "WAVE" where "WEBP" should be.
    [0x57, 0x41, 0x56, 0x45].forEach((b, i) => (wav[i + 8] = b));
    expect(detectImageType(wav)).toBeNull();
  });

  it('rejects a near-miss PNG signature', () => {
    const broken = withSignature([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b]);
    expect(detectImageType(broken)).toBeNull();
  });
});

describe('extensionFor', () => {
  it('maps each accepted type to a file extension', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/webp')).toBe('webp');
  });

  it('falls back to jpg for anything unexpected', () => {
    expect(extensionFor('image/tiff')).toBe('jpg');
  });
});

describe('toBase64', () => {
  it('encodes short input correctly', () => {
    expect(toBase64(new TextEncoder().encode('hello'))).toBe('aGVsbG8=');
  });

  it('encodes an empty buffer', () => {
    expect(toBase64(new Uint8Array(0))).toBe('');
  });

  it('handles every byte value, including those outside ASCII', () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) all[i] = i;
    const encoded = toBase64(all);
    // Decode it back and compare byte for byte.
    const decoded = Uint8Array.from(globalThis.atob(encoded), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual(Array.from(all));
  });

  it('encodes input larger than one chunk without throwing', () => {
    // A single spread of this many arguments would exceed the call limit.
    const large = new Uint8Array(0x8000 * 3 + 17).fill(0x41);
    const encoded = toBase64(large);
    const decoded = Uint8Array.from(globalThis.atob(encoded), (c) => c.charCodeAt(0));
    expect(decoded.length).toBe(large.length);
    expect(decoded[0]).toBe(0x41);
    expect(decoded[decoded.length - 1]).toBe(0x41);
  });
});

describe('parseHour', () => {
  it('accepts every valid hour', () => {
    for (let hour = 0; hour <= 23; hour += 1) {
      expect(parseHour(String(hour))).toBe(hour);
    }
  });

  it('rejects out-of-range, malformed and non-string values', () => {
    for (const value of ['24', '-1', '99', '1.5', 'noon', '', ' ', null, undefined, 7, {}]) {
      expect(parseHour(value)).toBeNull();
    }
  });
});

describe('parseRegionHint', () => {
  it('accepts a two-letter country code and normalises its case', () => {
    expect(parseRegionHint('BD')).toBe('BD');
    expect(parseRegionHint('bd')).toBe('BD');
    expect(parseRegionHint('  gb  ')).toBe('GB');
  });

  it('rejects anything that is not a two-letter code', () => {
    for (const value of ['USA', 'U', '', '12', 'B1', 'United Kingdom', null, 42]) {
      expect(parseRegionHint(value)).toBeNull();
    }
  });
});

describe('fallbackMealType', () => {
  it('maps the clock to a meal type', () => {
    expect(fallbackMealType(7)).toBe('breakfast');
    expect(fallbackMealType(10)).toBe('breakfast');
    expect(fallbackMealType(11)).toBe('lunch');
    expect(fallbackMealType(14)).toBe('lunch');
    expect(fallbackMealType(15)).toBe('dinner');
    expect(fallbackMealType(20)).toBe('dinner');
    expect(fallbackMealType(21)).toBe('snack');
    expect(fallbackMealType(2)).toBe('breakfast');
  });

  it('defaults to snack when the hour is unknown', () => {
    expect(fallbackMealType(null)).toBe('snack');
  });
});

describe('buildUserPrompt', () => {
  it('sends nothing identifying about the user', () => {
    const prompt = buildUserPrompt(13, 'BD');
    expect(prompt).toContain('13:00');
    expect(prompt).toContain('BD');
    // The prompt is built from exactly two inputs; nothing else can leak in.
    expect(prompt).not.toMatch(/@/);
    expect(prompt.toLowerCase()).not.toContain('allerg');
    expect(prompt.toLowerCase()).not.toContain('email');
  });

  it('omits the hour and region when they are unknown', () => {
    const prompt = buildUserPrompt(null, null);
    expect(prompt).toBe('Identify the foods in this photo and estimate their nutrition.');
  });

  it('includes only the hour when there is no region', () => {
    const prompt = buildUserPrompt(9, null);
    expect(prompt).toContain('9:00');
    expect(prompt.split('\n')).toHaveLength(2);
  });
});
