import {
  MIN_DAYS_FOR_INSIGHTS,
  MIN_ENTRIES_FOR_INSIGHTS,
  hasEnoughForInsights,
} from '../insights';

/**
 * Home and Progress both offered a row reading "Patterns counted from your
 * saved meals" from the first launch. Tapping it reached "Not enough logged
 * yet", so the app advertised a feature it could not yet deliver - which is
 * indistinguishable, from the outside, from one that is broken.
 *
 * The rule lives in one place because three screens now depend on agreeing
 * about it: the two that link to Insights, and Insights itself.
 */
describe('hasEnoughForInsights', () => {
  it('says no to a brand new account', () => {
    expect(hasEnoughForInsights(0, 0)).toBe(false);
  });

  it('says no to a first day, however many meals it holds', () => {
    expect(hasEnoughForInsights(9, 1)).toBe(false);
  });

  it('says no to meals spread thinly over several days', () => {
    expect(hasEnoughForInsights(MIN_ENTRIES_FOR_INSIGHTS - 1, 5)).toBe(false);
  });

  it('says yes exactly at the threshold, not one past it', () => {
    expect(hasEnoughForInsights(MIN_ENTRIES_FOR_INSIGHTS, MIN_DAYS_FOR_INSIGHTS)).toBe(
      true,
    );
  });

  it('agrees with the thresholds Insights itself reports', () => {
    expect(MIN_ENTRIES_FOR_INSIGHTS).toBe(3);
    expect(MIN_DAYS_FOR_INSIGHTS).toBe(2);
  });
});
