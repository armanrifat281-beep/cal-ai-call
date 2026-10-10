/**
 * Credential validation.
 *
 * Pure functions, so the rules are testable and identical everywhere they are
 * applied. The server validates independently; this exists to give immediate,
 * specific feedback instead of a round trip and a generic rejection.
 */

/** Minimum length. Supabase's own default is 6; 8 is the common floor. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Upper bound. bcrypt silently ignores input past 72 bytes, so a longer
 * password would give a false sense of strength.
 */
export const MAX_PASSWORD_LENGTH = 72;

/**
 * Deliberately permissive email check.
 *
 * Fully validating an address with a regex is not possible, and a strict
 * pattern rejects legitimate addresses. The only authority on whether an
 * address works is whether the confirmation email arrives, so this catches
 * obvious typos and nothing more.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normalizeEmail(email: string): string {
  // Addresses are case-insensitive in practice, and a stray space from
  // autofill or a paste is the most common cause of a failed sign-in.
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (normalized.length === 0) return 'Enter your email address.';
  if (normalized.length > 254) return 'That email address is too long.';
  if (!EMAIL_PATTERN.test(normalized)) {
    return 'That does not look like an email address.';
  }
  return null;
}

/**
 * Passwords that are common enough to be tried first in any credential
 * stuffing attempt. A short list, because a long one belongs on the server.
 */
const OBVIOUS_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyui',
  'qwerty123',
  'iloveyou',
  'abc12345',
  'letmein1',
  'football',
  'baseball',
  'welcome1',
  'admin123',
  'foodlens',
]);

export function validatePassword(password: string): string | null {
  if (password.length === 0) return 'Choose a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  // Whitespace-only would pass a length check and be impossible to retype.
  if (password.trim().length === 0) return 'A password cannot be only spaces.';
  if (OBVIOUS_PASSWORDS.has(password.toLowerCase())) {
    return 'That password is too common. Choose something else.';
  }
  return null;
}

/** Checked on sign-up, where a typo would lock the user out of their account. */
export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (confirmation.length === 0) return 'Re-enter your password.';
  if (password !== confirmation) return 'Those passwords do not match.';
  return null;
}

export interface CredentialErrors {
  email: string | null;
  password: string | null;
  confirmation?: string | null;
}

export function hasAnyError(errors: CredentialErrors): boolean {
  return Boolean(errors.email || errors.password || errors.confirmation);
}

/** Validates a sign-in form. */
export function validateSignIn(email: string, password: string): CredentialErrors {
  return {
    email: validateEmail(email),
    // Sign-in only needs a non-empty password: the stored one may predate any
    // rule we add later, and telling a returning user their existing password
    // is "too short" would be both wrong and alarming.
    password: password.length === 0 ? 'Enter your password.' : null,
  };
}

/** Validates a sign-up form, where the full password rules do apply. */
export function validateSignUp(
  email: string,
  password: string,
  confirmation: string,
): CredentialErrors {
  return {
    email: validateEmail(email),
    password: validatePassword(password),
    confirmation: validatePasswordConfirmation(password, confirmation),
  };
}
