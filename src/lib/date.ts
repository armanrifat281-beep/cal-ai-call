/**
 * Date helpers.
 *
 * Everything the user sees is in their LOCAL day: a meal eaten at 11pm belongs
 * to that evening, not to the next UTC day. Entries are stored as ISO instants
 * (`consumedAt`), and these helpers are the only place that converts an instant
 * into the local calendar day it belongs to.
 *
 * A "date key" is a local calendar date formatted `YYYY-MM-DD`.
 */

export type DateKey = string;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** The local calendar date of an instant, as `YYYY-MM-DD`. */
export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function isDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const parsed = fromDateKey(value);
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === value;
}

/** Local midnight at the start of a date key. */
export function fromDateKey(key: DateKey): Date {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10));
  // Constructing with separate arguments gives LOCAL midnight; `new Date(key)`
  // would parse the string as UTC and shift the day in most time zones.
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function startOfLocalDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** The last representable millisecond of the local day. */
export function endOfLocalDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/**
 * Add days to a date key, staying on calendar days.
 *
 * Using the Date constructor rather than millisecond arithmetic keeps this
 * correct across daylight-saving transitions, where a day is 23 or 25 hours.
 */
export function addDaysToKey(key: DateKey, days: number): DateKey {
  const base = fromDateKey(key);
  base.setDate(base.getDate() + days);
  return toDateKey(base);
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

/** Whole days from `fromKey` to `toKey`; negative when `toKey` is earlier. */
export function daysBetweenKeys(fromKey: DateKey, toKey: DateKey): number {
  const a = fromDateKey(fromKey).getTime();
  const b = fromDateKey(toKey).getTime();
  // Round because a DST boundary makes the raw difference 23 or 25 hours.
  return Math.round((b - a) / 86_400_000);
}

/** Inclusive list of date keys from `startKey` to `endKey`. */
export function dateKeysInRange(startKey: DateKey, endKey: DateKey): DateKey[] {
  const span = daysBetweenKeys(startKey, endKey);
  if (span < 0) return [];
  const keys: DateKey[] = [];
  for (let offset = 0; offset <= span; offset += 1) {
    keys.push(addDaysToKey(startKey, offset));
  }
  return keys;
}

/**
 * The Monday-based start of the week containing `key`.
 *
 * @param weekStartsOn 0 = Sunday, 1 = Monday (default).
 */
export function startOfWeekKey(key: DateKey, weekStartsOn: 0 | 1 = 1): DateKey {
  const date = fromDateKey(key);
  const day = date.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  return addDaysToKey(key, -diff);
}

/** The last seven days ending at (and including) `key`, oldest first. */
export function lastSevenDayKeys(key: DateKey): DateKey[] {
  return dateKeysInRange(addDaysToKey(key, -6), key);
}

/** "Today", "Yesterday", or a short date like "Mon 6 Oct". */
export function formatDayLabel(key: DateKey, now: Date = new Date()): string {
  const today = toDateKey(now);
  if (key === today) return 'Today';
  if (key === addDaysToKey(today, -1)) return 'Yesterday';
  if (key === addDaysToKey(today, 1)) return 'Tomorrow';

  const date = fromDateKey(key);
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Clock time for a timeline row, e.g. "8:15 AM" in the device locale. */
export function formatTimeOfDay(isoInstant: string): string {
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Group things that carry an ISO instant into local-day buckets. */
export function groupByDateKey<T>(
  items: readonly T[],
  getInstant: (item: T) => string,
): Map<DateKey, T[]> {
  const buckets = new Map<DateKey, T[]>();
  for (const item of items) {
    const date = new Date(getInstant(item));
    if (Number.isNaN(date.getTime())) continue;
    const key = toDateKey(date);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  return buckets;
}
