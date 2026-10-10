import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  hasAnyError,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateSignIn,
  validateSignUp,
} from '../validation';

describe('normalizeEmail', () => {
  it('lowercases and trims, which fixes the most common sign-in failure', () => {
    expect(normalizeEmail('  Alice@Example.COM  ')).toBe('alice@example.com');
  });
});

describe('validateEmail', () => {
  it('accepts ordinary and awkward-but-valid addresses', () => {
    for (const email of [
      'alice@example.com',
      'ALICE@EXAMPLE.COM',
      'alice.smith+food@example.co.uk',
      "o'brien@example.ie",
      'alice_smith@sub.domain.example.org',
      'a@b.co',
    ]) {
      expect(validateEmail(email)).toBeNull();
    }
  });

  it('rejects obvious mistakes', () => {
    for (const email of [
      '',
      '   ',
      'alice',
      'alice@',
      '@example.com',
      'alice@example',
      'alice example@test.com',
      'alice@@example.com',
      'alice@.com',
    ]) {
      expect(validateEmail(email)).not.toBeNull();
    }
  });

  it('rejects an absurdly long address', () => {
    expect(validateEmail(`${'a'.repeat(250)}@example.com`)).toContain('too long');
  });

  it('gives a specific message for an empty field', () => {
    expect(validateEmail('')).toBe('Enter your email address.');
  });
});

describe('validatePassword', () => {
  it('accepts a reasonable password', () => {
    expect(validatePassword('correct horse battery')).toBeNull();
    expect(validatePassword('Tr0ubador!x')).toBeNull();
  });

  it('accepts exactly the minimum length', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('rejects one character under the minimum', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toContain(
      `at least ${MIN_PASSWORD_LENGTH}`,
    );
  });

  it('rejects past the bcrypt limit, where extra characters are ignored', () => {
    expect(validatePassword('a'.repeat(MAX_PASSWORD_LENGTH))).toBeNull();
    expect(validatePassword('a'.repeat(MAX_PASSWORD_LENGTH + 1))).toContain('at most');
  });

  it('rejects whitespace-only, which passes a naive length check', () => {
    expect(validatePassword('          ')).toContain('only spaces');
  });

  it('rejects the passwords an attacker tries first', () => {
    for (const password of ['password', 'PASSWORD123', '12345678', 'qwerty123', 'foodlens']) {
      expect(validatePassword(password)).toContain('too common');
    }
  });

  it('does not impose character-class rules', () => {
    // Length and uniqueness matter; forcing a symbol mostly produces
    // "Password1!" and a sticky note.
    expect(validatePassword('allsmalllettersnonumbers')).toBeNull();
  });

  it('gives a specific message for an empty field', () => {
    expect(validatePassword('')).toBe('Choose a password.');
  });
});

describe('validatePasswordConfirmation', () => {
  it('accepts a match', () => {
    expect(validatePasswordConfirmation('abcdefgh', 'abcdefgh')).toBeNull();
  });

  it('rejects a mismatch', () => {
    expect(validatePasswordConfirmation('abcdefgh', 'abcdefgi')).toContain('do not match');
  });

  it('rejects an empty confirmation', () => {
    expect(validatePasswordConfirmation('abcdefgh', '')).toBe('Re-enter your password.');
  });

  it('is case sensitive', () => {
    expect(validatePasswordConfirmation('abcdefgh', 'ABCDEFGH')).not.toBeNull();
  });
});

describe('validateSignIn', () => {
  it('passes a well-formed sign-in', () => {
    const errors = validateSignIn('alice@example.com', 'anything-at-all');
    expect(hasAnyError(errors)).toBe(false);
  });

  it('does NOT apply the length rule to an existing password', () => {
    // A returning user's password may predate any rule we add. Telling them
    // it is "too short" would be wrong and alarming.
    const errors = validateSignIn('alice@example.com', 'short');
    expect(errors.password).toBeNull();
  });

  it('still requires a password to have been typed', () => {
    expect(validateSignIn('alice@example.com', '').password).toBe('Enter your password.');
  });

  it('reports a malformed email', () => {
    expect(validateSignIn('not-an-email', 'password').email).not.toBeNull();
  });
});

describe('validateSignUp', () => {
  it('passes a well-formed sign-up', () => {
    const errors = validateSignUp('alice@example.com', 'a-good-passphrase', 'a-good-passphrase');
    expect(hasAnyError(errors)).toBe(false);
  });

  it('applies the full password rules', () => {
    expect(validateSignUp('alice@example.com', 'short', 'short').password).not.toBeNull();
    expect(
      validateSignUp('alice@example.com', 'password', 'password').password,
    ).toContain('too common');
  });

  it('catches a confirmation typo, which would otherwise lock the user out', () => {
    const errors = validateSignUp('alice@example.com', 'a-good-passphrase', 'a-good-passphrese');
    expect(errors.password).toBeNull();
    expect(errors.confirmation).toContain('do not match');
    expect(hasAnyError(errors)).toBe(true);
  });

  it('reports every problem at once rather than one at a time', () => {
    const errors = validateSignUp('bad', 'short', 'different');
    expect(errors.email).not.toBeNull();
    expect(errors.password).not.toBeNull();
    expect(errors.confirmation).not.toBeNull();
  });
});

describe('hasAnyError', () => {
  it('is false only when everything is null', () => {
    expect(hasAnyError({ email: null, password: null })).toBe(false);
    expect(hasAnyError({ email: null, password: null, confirmation: null })).toBe(false);
    expect(hasAnyError({ email: 'bad', password: null })).toBe(true);
    expect(hasAnyError({ email: null, password: 'bad' })).toBe(true);
    expect(hasAnyError({ email: null, password: null, confirmation: 'bad' })).toBe(true);
  });
});
