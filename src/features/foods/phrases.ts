/**
 * Pulling food names out of a sentence.
 *
 * This is the whole of the "recognition" behind the describe-a-meal screen,
 * and it is deliberately lexical rather than a model. Everything it does is
 * splitting and tidying text; the actual identification is the nutrition
 * database's, which is the same lookup the search screen uses. Nothing here
 * invents a food, and nothing here invents a number.
 *
 * It is not clever, and the screen does not pretend it is: every phrase it
 * finds is shown to the user with what the database matched it to, and
 * anything wrong can be taken out with one tap.
 */

/**
 * Where one food ends and the next begins.
 *
 * Commas and "and" are how people actually list what they ate. "With" is
 * included because "eggs with a salad" is two foods, not one dish - and the
 * cost of being wrong is a chip the user removes.
 */
const SEPARATORS = /,|\band\b|\bwith\b|\bplus\b|&|\n|\+/gi;

/**
 * Words that carry no food in them.
 *
 * Stripped from the front and back of a phrase only, never the middle:
 * "cream of tomato soup" has to survive, and so does "a slice of bread" once
 * its leading article is gone.
 */
const EDGE_NOISE = new Set([
  'i', 'had', 'ate', 'have', 'having', 'eaten', 'for', 'a', 'an', 'the',
  'some', 'my', 'of', 'bit', 'little', 'few', 'today', 'this', 'morning',
  'afternoon', 'evening', 'breakfast', 'lunch', 'dinner', 'snack', 'also',
  'then', 'just', 'on', 'side', 'it', 'was', 'were', 'there', 'added',
  'splash', 'drizzle', 'handful', 'piece', 'slice', 'plate', 'bowl', 'cup',
]);

/** Below this a phrase is too short to be worth a database round trip. */
const MIN_LENGTH = 3;

/** Enough for a described meal; past this it is a shopping list. */
export const MAX_PHRASES = 8;

/**
 * The food-ish phrases in a sentence, in the order they were written.
 *
 * Duplicates are dropped: "eggs and toast and eggs" is two foods. Case is
 * ignored for that comparison but the user's own wording is what comes
 * back, because it is what they will read on the chip.
 */
export function foodPhrases(text: string): string[] {
  const seen = new Set<string>();
  const phrases: string[] = [];

  for (const chunk of text.split(SEPARATORS)) {
    const phrase = trimNoise(chunk);
    if (phrase.length < MIN_LENGTH) continue;

    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    phrases.push(phrase);
    if (phrases.length >= MAX_PHRASES) break;
  }

  return phrases;
}

/** Strips punctuation, then filler words from each end. */
function trimNoise(chunk: string): string {
  const words = chunk
    .replace(/[.!?;:"()]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);

  let start = 0;
  let end = words.length;

  while (start < end && EDGE_NOISE.has(words[start]!.toLowerCase())) start += 1;
  while (end > start && EDGE_NOISE.has(words[end - 1]!.toLowerCase())) end -= 1;

  return words.slice(start, end).join(' ');
}
