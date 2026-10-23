/**
 * A third kind of AI request: generating a training plan.
 *
 * Counted separately from photo scans and recipes rather than folded into
 * one of them. Two reasons, and the second is the one that matters:
 *
 * 1. It is a different cost. A plan is a long text answer; a scan is an
 *    image and a short one. One shared counter makes the cheaper feature
 *    pay for the dearer one.
 * 2. Mislabelling it would make the usage table lie. `scan_events` is
 *    what anybody would read to find out what this project spends its
 *    allowance on, and a plan recorded as a "recipe_generation" is a
 *    wrong answer to that question, forever.
 *
 * The limit is deliberately low. A training plan is something a person
 * needs a handful of times a year, not a handful of times an hour, and a
 * generous limit here buys nothing except a bill.
 */

alter type public.ai_request_kind add value if not exists 'workout_generation';
