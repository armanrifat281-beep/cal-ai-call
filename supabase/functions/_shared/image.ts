/**
 * Image checks every function that accepts an upload needs.
 *
 * Moved here from `analyze-meal/helpers.ts` when a second function started
 * taking photographs: one copy of "is this actually an image" is the whole
 * point, because the copy that drifts is the one that forwards an SVG to a
 * provider as a JPEG.
 *
 * Deliberately free of Deno and npm imports, so the project's ordinary Jest
 * setup can test it.
 */

/** Formats the providers accept and we are willing to forward. */
export const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Identifies an image format from its magic bytes.
 *
 * The client's declared content type is a claim, not evidence: a request can
 * say anything. Reading the leading bytes is what actually establishes the
 * format, and returning null for anything unrecognised means an executable
 * or an SVG cannot be forwarded to the provider as an "image".
 */
export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 'P' 'N' 'G' CR LF SUB LF
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) {
    return 'image/png';
  }

  // WebP: "RIFF" <4 size bytes> "WEBP"
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (
    riff.every((byte, index) => bytes[index] === byte) &&
    webp.every((byte, index) => bytes[index + 8] === byte)
  ) {
    return 'image/webp';
  }

  return null;
}

export function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Base64-encodes bytes in chunks.
 *
 * `String.fromCharCode(...bytes)` on a multi-megabyte array exceeds the
 * argument limit and throws, so the input is walked in 32 KB slices.
 */
export function toBase64(bytes: Uint8Array): string {
  const CHUNK = 32 * 1024;
  let binary = '';
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}
