import { greetingFor, normalizeDisplayName, validateDisplayName } from '../greeting';

describe('greetingFor', () => {
  it('greets by part of day', () => {
    expect(greetingFor(7, null)).toBe('Good morning');
    expect(greetingFor(13, null)).toBe('Good afternoon');
    expect(greetingFor(20, null)).toBe('Good evening');
  });

  it('uses the name once there is one', () => {
    expect(greetingFor(9, 'Yeasin')).toBe('Good morning, Yeasin');
  });

  it('ignores a name that is only spaces', () => {
    expect(greetingFor(9, '   ')).toBe('Good morning');
  });

  it('handles the boundaries', () => {
    expect(greetingFor(0, null)).toBe('Good morning');
    expect(greetingFor(11, null)).toBe('Good morning');
    expect(greetingFor(12, null)).toBe('Good afternoon');
    expect(greetingFor(17, null)).toBe('Good afternoon');
    expect(greetingFor(18, null)).toBe('Good evening');
    expect(greetingFor(23, null)).toBe('Good evening');
  });
});

describe('validateDisplayName', () => {
  it('accepts a normal name', () => {
    expect(validateDisplayName('Yeasin')).toBeNull();
  });

  it('accepts empty, which clears the name', () => {
    expect(validateDisplayName('')).toBeNull();
    expect(validateDisplayName('   ')).toBeNull();
  });

  it('refuses something too long to be a name', () => {
    expect(validateDisplayName('a'.repeat(41))).toBe('Use 40 characters or fewer.');
  });

  it('measures the trimmed length', () => {
    expect(validateDisplayName(`  ${'a'.repeat(40)}  `)).toBeNull();
  });
});

describe('normalizeDisplayName', () => {
  it('trims', () => {
    expect(normalizeDisplayName('  Yeasin  ')).toBe('Yeasin');
  });

  it('stores nothing rather than an empty string', () => {
    expect(normalizeDisplayName('   ')).toBeNull();
  });

  it('never stores more than the column allows', () => {
    expect(normalizeDisplayName('a'.repeat(100))).toHaveLength(40);
  });
});
