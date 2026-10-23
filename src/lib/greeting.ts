/**
 * The heading at the top of Home.
 *
 * It is the date unless the user has told the app their name, in which case
 * it greets them by it. That is the whole reason the app asks for a name:
 * without somewhere it is used, a name field is a box that stores a string
 * and shows it back.
 *
 * Deliberately quiet. No exclamation marks, no "Welcome back!", nothing that
 * reads as a notification.
 *
 * "Morning" rather than "Good morning": it is set at display size at the top
 * of the screen, where the extra word pushes a name of any length onto a
 * second line, and the word doing the work is the time of day anyway.
 */
export function greetingFor(hour: number, name: string | null): string {
  const trimmed = name?.trim() ?? '';
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  return trimmed.length > 0 ? `${part}, ${trimmed}` : part;
}

/**
 * What a name is allowed to be, with the reason returned rather than a
 * boolean, so the field can say why.
 */
export function validateDisplayName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null; // Empty is fine: it clears the name.
  if (trimmed.length > 40) return 'Use 40 characters or fewer.';
  return null;
}

/** The stored form: trimmed, or null when there is nothing to store. */
export function normalizeDisplayName(value: string): string | null {
  const trimmed = value.trim().slice(0, 40);
  return trimmed.length > 0 ? trimmed : null;
}
