import {
  addDaysToKey,
  dateKeysInRange,
  daysBetweenKeys,
  formatDayLabel,
  fromDateKey,
  groupByDateKey,
  isDateKey,
  isSameLocalDay,
  lastSevenDayKeys,
  startOfLocalDay,
  endOfLocalDay,
  startOfWeekKey,
  toDateKey,
  todayKey,
} from '../date';

describe('toDateKey / fromDateKey', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(toDateKey(new Date(2026, 0, 5, 13, 30))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('round-trips a key through a local Date', () => {
    for (const key of ['2026-01-01', '2026-02-28', '2026-10-10', '2026-12-31']) {
      expect(toDateKey(fromDateKey(key))).toBe(key);
    }
  });

  it('parses a key to LOCAL midnight, not UTC midnight', () => {
    const date = fromDateKey('2026-06-15');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it('keeps a late-evening instant on the same local day', () => {
    // The classic bug: 23:30 local can be the next day in UTC.
    const lateNight = new Date(2026, 9, 10, 23, 30);
    expect(toDateKey(lateNight)).toBe('2026-10-10');
  });
});

describe('isDateKey', () => {
  it('accepts well-formed, real dates', () => {
    expect(isDateKey('2026-10-10')).toBe(true);
    expect(isDateKey('2024-02-29')).toBe(true);
  });

  it('rejects malformed or impossible dates', () => {
    expect(isDateKey('2026-1-1')).toBe(false);
    expect(isDateKey('10-10-2026')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2025-02-29')).toBe(false);
    expect(isDateKey('')).toBe(false);
  });
});

describe('addDaysToKey', () => {
  it('moves forward and backward across month boundaries', () => {
    expect(addDaysToKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap years', () => {
    expect(addDaysToKey('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysToKey('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDaysToKey('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('is the identity for zero', () => {
    expect(addDaysToKey('2026-10-10', 0)).toBe('2026-10-10');
  });
});

describe('daysBetweenKeys', () => {
  it('counts whole days in both directions', () => {
    expect(daysBetweenKeys('2026-10-10', '2026-10-17')).toBe(7);
    expect(daysBetweenKeys('2026-10-17', '2026-10-10')).toBe(-7);
    expect(daysBetweenKeys('2026-10-10', '2026-10-10')).toBe(0);
  });

  it('stays exact across a daylight-saving transition', () => {
    // Most northern-hemisphere zones shift in late March and late October.
    expect(daysBetweenKeys('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetweenKeys('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('dateKeysInRange', () => {
  it('is inclusive of both ends', () => {
    expect(dateKeysInRange('2026-10-08', '2026-10-10')).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
  });

  it('returns a single day when the ends match', () => {
    expect(dateKeysInRange('2026-10-10', '2026-10-10')).toEqual(['2026-10-10']);
  });

  it('returns nothing when the range is backwards', () => {
    expect(dateKeysInRange('2026-10-10', '2026-10-08')).toEqual([]);
  });
});

describe('startOfWeekKey', () => {
  it('finds the Monday of the containing week by default', () => {
    // 2026-10-10 is a Saturday.
    expect(startOfWeekKey('2026-10-10')).toBe('2026-10-05');
    expect(startOfWeekKey('2026-10-05')).toBe('2026-10-05');
    // Sunday belongs to the week that started the previous Monday.
    expect(startOfWeekKey('2026-10-11')).toBe('2026-10-05');
  });

  it('supports Sunday-start weeks', () => {
    expect(startOfWeekKey('2026-10-10', 0)).toBe('2026-10-04');
    expect(startOfWeekKey('2026-10-11', 0)).toBe('2026-10-11');
  });
});

describe('lastSevenDayKeys', () => {
  it('returns seven keys, oldest first, ending on the given day', () => {
    const keys = lastSevenDayKeys('2026-10-10');
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2026-10-04');
    expect(keys[6]).toBe('2026-10-10');
  });
});

describe('startOfLocalDay / endOfLocalDay', () => {
  it('clamps to the first and last millisecond of the local day', () => {
    const mid = new Date(2026, 9, 10, 14, 22, 33, 444);
    const start = startOfLocalDay(mid);
    const end = endOfLocalDay(mid);
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0]);
    expect([end.getHours(), end.getMinutes(), end.getSeconds()]).toEqual([23, 59, 59]);
    expect(end.getMilliseconds()).toBe(999);
    expect(toDateKey(start)).toBe(toDateKey(end));
  });

  it('does not mutate the input', () => {
    const original = new Date(2026, 9, 10, 14, 0, 0);
    const copy = new Date(original.getTime());
    startOfLocalDay(original);
    endOfLocalDay(original);
    expect(original.getTime()).toBe(copy.getTime());
  });
});

describe('isSameLocalDay', () => {
  it('compares calendar days, not elapsed time', () => {
    expect(isSameLocalDay(new Date(2026, 9, 10, 0, 1), new Date(2026, 9, 10, 23, 59))).toBe(true);
    expect(isSameLocalDay(new Date(2026, 9, 10, 23, 59), new Date(2026, 9, 11, 0, 1))).toBe(false);
  });
});

describe('formatDayLabel', () => {
  const now = new Date(2026, 9, 10, 12, 0);

  it('uses relative words for the days around now', () => {
    expect(formatDayLabel('2026-10-10', now)).toBe('Today');
    expect(formatDayLabel('2026-10-09', now)).toBe('Yesterday');
    expect(formatDayLabel('2026-10-11', now)).toBe('Tomorrow');
  });

  it('falls back to a short date further away', () => {
    const label = formatDayLabel('2026-10-01', now);
    expect(label).not.toBe('Today');
    expect(label).toMatch(/Oct|10/);
  });
});

describe('todayKey', () => {
  it('matches toDateKey of the same instant', () => {
    const now = new Date(2026, 4, 3, 7, 0);
    expect(todayKey(now)).toBe(toDateKey(now));
  });
});

describe('groupByDateKey', () => {
  it('buckets items by their local day', () => {
    const items = [
      { id: 'a', at: new Date(2026, 9, 10, 8, 0).toISOString() },
      { id: 'b', at: new Date(2026, 9, 10, 20, 0).toISOString() },
      { id: 'c', at: new Date(2026, 9, 9, 12, 0).toISOString() },
    ];
    const groups = groupByDateKey(items, (item) => item.at);
    expect(groups.get('2026-10-10')?.map((i) => i.id)).toEqual(['a', 'b']);
    expect(groups.get('2026-10-09')?.map((i) => i.id)).toEqual(['c']);
  });

  it('skips items with an unparseable instant instead of throwing', () => {
    const groups = groupByDateKey([{ at: 'not-a-date' }], (item) => item.at);
    expect(groups.size).toBe(0);
  });
});
