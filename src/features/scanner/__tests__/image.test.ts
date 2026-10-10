import {
  ALLOWED_MIME_TYPES,
  MAX_IMAGE_EDGE,
  fitWithinMaxEdge,
  isAllowedMimeType,
  mimeTypeFromUri,
} from '../image';

describe('isAllowedMimeType', () => {
  it('accepts exactly the formats we are willing to upload', () => {
    for (const type of ALLOWED_MIME_TYPES) {
      expect(isAllowedMimeType(type)).toBe(true);
    }
  });

  it('rejects anything else, including near-misses and non-images', () => {
    for (const type of [
      'image/heic',
      'image/gif',
      'image/svg+xml',
      'application/pdf',
      'text/html',
      'IMAGE/JPEG',
      '',
      null,
      undefined,
    ]) {
      expect(isAllowedMimeType(type)).toBe(false);
    }
  });
});

describe('mimeTypeFromUri', () => {
  it('maps common photo extensions', () => {
    expect(mimeTypeFromUri('file:///tmp/meal.jpg')).toBe('image/jpeg');
    expect(mimeTypeFromUri('file:///tmp/meal.JPEG')).toBe('image/jpeg');
    expect(mimeTypeFromUri('file:///tmp/meal.png')).toBe('image/png');
    expect(mimeTypeFromUri('file:///tmp/meal.webp')).toBe('image/webp');
  });

  it('recognizes HEIC, which we convert rather than reject', () => {
    expect(mimeTypeFromUri('file:///tmp/IMG_0001.HEIC')).toBe('image/heic');
    expect(mimeTypeFromUri('file:///tmp/IMG_0001.heif')).toBe('image/heic');
  });

  it('ignores a query string on a content URI', () => {
    expect(mimeTypeFromUri('content://media/external/1.jpg?width=100')).toBe('image/jpeg');
  });

  it('returns null for an unknown or missing extension', () => {
    expect(mimeTypeFromUri('file:///tmp/meal.txt')).toBeNull();
    expect(mimeTypeFromUri('file:///tmp/meal')).toBeNull();
    expect(mimeTypeFromUri('')).toBeNull();
  });
});

describe('fitWithinMaxEdge', () => {
  it('leaves an already-small image alone', () => {
    expect(fitWithinMaxEdge(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('scales a landscape photo by its width', () => {
    const result = fitWithinMaxEdge(4032, 3024);
    expect(result.width).toBe(MAX_IMAGE_EDGE);
    expect(result.height).toBe(Math.round(3024 * (MAX_IMAGE_EDGE / 4032)));
  });

  it('scales a portrait photo by its height', () => {
    const result = fitWithinMaxEdge(3024, 4032);
    expect(result.height).toBe(MAX_IMAGE_EDGE);
    expect(result.width).toBe(Math.round(3024 * (MAX_IMAGE_EDGE / 4032)));
  });

  it('preserves aspect ratio within a rounding pixel', () => {
    const source = { width: 4032, height: 3024 };
    const result = fitWithinMaxEdge(source.width, source.height);
    const sourceRatio = source.width / source.height;
    const resultRatio = result.width / result.height;
    expect(Math.abs(sourceRatio - resultRatio)).toBeLessThan(0.01);
  });

  it('handles a square image', () => {
    expect(fitWithinMaxEdge(2000, 2000)).toEqual({
      width: MAX_IMAGE_EDGE,
      height: MAX_IMAGE_EDGE,
    });
  });

  it('returns zeroes for degenerate input instead of NaN', () => {
    expect(fitWithinMaxEdge(0, 100)).toEqual({ width: 0, height: 0 });
    expect(fitWithinMaxEdge(-5, 100)).toEqual({ width: 0, height: 0 });
  });

  it('respects a custom maximum edge', () => {
    expect(fitWithinMaxEdge(1000, 500, 100)).toEqual({ width: 100, height: 50 });
  });
});
