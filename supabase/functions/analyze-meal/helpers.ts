/**
 * Pure helpers for the analyze-meal function.
 *
 * Kept free of Deno and npm imports so they can be unit tested with the
 * project's normal Jest setup. `index.ts` holds everything that needs a
 * runtime: the HTTP handler, the Anthropic call and the database writes.
 */

import { MEAL_TYPES } from './schema.ts';

/** Image formats Claude accepts and we are willing to forward. */
export const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Identifies an image format from its magic bytes.
 *
 * The client's declared content type is a claim, not evidence: a request can
 * say anything. Reading the leading bytes is what actually establishes the
 * format, and returning null for anything unrecognised means an executable or
 * an SVG cannot be forwarded to the provider as an "image".
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
  const CHUNK = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

/** Reads the caller's local hour, or null when it is absent or nonsensical. */
export function parseHour(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  if (!/^\d{1,2}$/.test(value.trim())) return null;
  const hour = Number.parseInt(value, 10);
  return hour >= 0 && hour <= 23 ? hour : null;
}

/** Accepts an ISO 3166-1 alpha-2 code and nothing else. */
export function parseRegionHint(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
}

/** Meal type implied by the clock, used when the model does not give one. */
export function fallbackMealType(hour: number | null): (typeof MEAL_TYPES)[number] {
  if (hour === null) return 'snack';
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

/**
 * Builds the per-request prompt.
 *
 * Only two pieces of context are ever included: the local hour and an
 * optional country code. Nothing identifying about the user is sent - no
 * name, no email, and never their allergy list.
 */
export function buildUserPrompt(hour: number | null, regionHint: string | null): string {
  const lines = ['Identify the foods in this photo and estimate their nutrition.'];
  if (hour !== null) {
    lines.push(
      `It is about ${hour}:00 for the person who took it, which may hint at the meal type.`,
    );
  }
  if (regionHint) {
    lines.push(
      `They usually eat food from ${regionHint}; prefer dish names common there when a dish is ambiguous.`,
    );
  }
  return lines.join('\n');
}
