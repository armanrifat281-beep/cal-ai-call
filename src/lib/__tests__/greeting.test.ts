import { greetingFor, normalizeDisplayName, validateDisplayName } from '../greeting';

describe('greetingFor', () => {
  it('greets by part of day', () => {
    expect(greetingFor(7, null)).toBe('Morning');
    expect(greetingFor(13, null)).toBe('Afternoon');
    expect(greetingFor(20, null)).toBe('Evening');
  });

  it('uses the name once there is one', () => {
    expect(greetingFor(9, 'Yeasin')).toBe('Morning, Yeasin');
  });

  it('ignores a name that is only spaces', () => {
    expect(greetingFor(9, '   ')).toBe('Morning');
  });

  it('handles the boundaries', () => {
    expect(greetingFor(0, null)).toBe('Morning');
    expect(greetingFor(11, null)).toBe('Morning');
    expect(greetingFor(12, null)).toBe('Afternoon');
    expect(greetingFor(17, null)).toBe('Afternoon');
    expect(greetingFor(18, null)).toBe('Evening');
    expect(greetingFor(23, null)).toBe('Evening');
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
