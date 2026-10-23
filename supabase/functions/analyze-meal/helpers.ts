/**
 * Pure helpers for the analyze-meal function.
 *
 * Kept free of Deno and npm imports so they can be unit tested with the
 * project's normal Jest setup. `index.ts` holds everything that needs a
 * runtime: the HTTP handler, the Anthropic call and the database writes.
 */

import { MEAL_TYPES } from './schema.ts';

/*
  The image checks moved to `_shared/image.ts` when the label reader started
  accepting photographs too. Re-exported here so this module's own callers
  and tests are untouched by that move.
*/
export {
  ALLOWED_MIME_TYPES,
  detectImageType,
  extensionFor,
  toBase64,
} from '../_shared/image.ts';

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
