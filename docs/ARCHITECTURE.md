# Architecture

Why the code is shaped the way it is.

## The central problem

A photo cannot tell you how many calories are on a plate. It can often tell you
*what* is on the plate. Those are very different claims, and conflating them is
how a nutrition app ends up lying to its users.

So the system is split along exactly that line:

```
  photo
    |
    v
[ recognition ]   "this looks like grilled chicken and white rice"
    |                                    (AI, uncertain)
    v
[ matching ]      chicken -> USDA FDC record 331960
    |                                    (lookup, verifiable)
    v
[ portions ]      "1 piece" -> 120 g, using the record's own measures
    |                                    (arithmetic, exact)
    v
[ nutrients ]     120 g of record 331960 -> 198 kcal, 37 g protein
    |                                    (arithmetic, exact)
    v
  journal entry, with each item labelled by where its numbers came from
```

Each stage has a different trust level, and the UI shows which one a number came
from. A `database` item means "we looked this up and scaled it". An
`ai_estimate` item means "a model guessed". They never look alike.

## Module boundaries

### `src/features/nutrition` - the engine

Pure functions. No network, no React, no device APIs. This is where portions
become grams and grams become nutrients.

It is pure for two reasons. It makes the arithmetic exhaustively testable, and
it means the engine does not care whether the numbers arrived from a model, a
database or the keyboard.

Three rules are enforced here:

- `null` means unknown and never becomes `0`. `sumNutrients` returns the keys
  it could not fully total, so the UI can say "12 g or more" rather than
  implying a complete count.
- Portion conversion returns `null` when it cannot be done. Grams and ounces
  convert on their own; "1 cup" only converts when the food record says what a
  cup of that food weighs.
- Every estimate is checked for internal consistency: if stated calories do not
  match the macro grams at 4/4/9 kcal per gram, that is surfaced as a warning.

### `src/features/journal` - data access behind a contract

`JournalRepository` is an interface. There are two implementations:

- `createLocalJournalRepository()` - AsyncStorage, device only. Used before an
  account exists. Real persistence, not mock data, with an entry cap and
  serialized writes so concurrent saves cannot overwrite each other.
- A Supabase implementation, to come. Screens will not change.

`hooks.ts` is the single place that picks one. That is the whole swap.

### `src/features/scanner` - untrusted input handling

Three separate concerns:

- `image.ts` validates, resizes and re-encodes a photo on the device. It rejects
  unsupported types and oversized files early, and converts HEIC to JPEG because
  most model APIs reject HEIC. The server validates again; a client check is
  never a security boundary.
- `parseAnalysis.ts` validates the response. Model output is untrusted input:
  fields go missing and numbers arrive as strings. Every field is checked, items
  that cannot be rendered are dropped, and an unrecognised confidence level is
  read as `low` rather than `high`. Low confidence anywhere forces user
  confirmation regardless of what the response claims about itself.
- `service.ts` is the HTTP client, pointed at our own Edge Function rather than
  at a provider, with a timeout and status-specific error messages.

### `src/features/memory` - insights that can be checked

`generateInsights` counts and averages over stored entries. Nothing more.

Every insight carries `evidence`: the ids of the entries it used and a
plain-language note on how it was counted, which the UI shows under "How was
this counted?". The `food_insights` table rejects a row whose evidence is
missing or empty, so an unsupported claim cannot even be stored.

Below a threshold of real data it produces nothing and says what is missing,
rather than extrapolating from two meals.

Predictive personalization is deliberately out of scope for this version.

## Security model

### Secrets

The device holds only the Supabase URL and anon key, both designed to be public.
Provider keys live as Edge Function secrets. The app never talks to an AI or
nutrition provider directly, which is also what makes usage limits enforceable.

### Row Level Security

RLS is *the* boundary; client-side filtering is a convenience. Every table has
it enabled, and `supabase/tests/10_rls_tests.sql` proves it by impersonating one
user and trying to read and write another's rows.

Two details worth knowing:

**`food_entry_items.user_id` is denormalized.** It makes each policy one indexed
comparison instead of a join. A `before insert or update` trigger forces it to
the parent entry's owner, so it cannot diverge, and the insert policy *also*
checks the parent entry directly. Either mechanism alone would be sufficient;
having both means a future change to one cannot open a hole on its own.

**`subscription_entitlements` has no client write policy at all.** Only the
service role can write it, so premium access cannot be granted by a client-side
flag. `current_subscription_tier()` applies the status and expiry rules in one
place.

**Beware of CHECK constraints that evaluate to NULL** - they pass. The allergy
constraint originally read
`not allergy_awareness_enabled or array_length(allergens, 1) >= 1`, which
accepts an empty array, because `array_length('{}', 1)` is NULL. The RLS test
suite caught it. Anything comparing a possibly-NULL expression now wraps it in
`coalesce`, and the JSON shape checks assert the key exists with `?` before
inspecting its type.

### Photos

Private bucket, one folder per user, enforced by comparing the first path
segment to `auth.uid()`. Retention is off by default: unless the user opts in,
a photo is deleted straight after analysis and the journal keeps only names and
numbers.

### Data sent for analysis

The photo, the local hour (to suggest a meal type) and an optional country code.
No name, no email, and never the allergy list.

## Local time, not UTC

A meal eaten at 11pm belongs to that evening. Entries store an ISO instant, and
`src/lib/date.ts` is the only place that converts an instant into the local
calendar day it belongs to. Day arithmetic goes through the `Date` constructor
rather than adding milliseconds, so daylight-saving transitions, where a day is
23 or 25 hours, stay correct.

## Testing

| Layer | Approach |
| --- | --- |
| Nutrition engine | Exhaustive unit tests, including round-trips and bad input |
| Dates | Unit tests covering DST, leap years, month and year boundaries |
| Local repository | Integration tests against the AsyncStorage mock, including concurrent writes |
| Response validation | Unit tests built from malformed provider responses |
| Meal editor | Component tests driving the real UI with user events |
| Database | Migrations applied to a temporary Postgres, then RLS attacked from another user's session |

Two real bugs were found this way and fixed: a factor-of-100 error in
`reportionItem`, and the NULL-passes CHECK constraint described above.

## Known gaps

- No authentication yet, so no Supabase repository and no photo analysis.
- Insights are computed on the device and not yet cached in `food_insights`.
- The language setting is stored but the interface is English only.
- `ml` portions assume water density when the food record gives no weight. It is
  flagged in the UI, but it is wrong for oils and syrups.
- Entry list rendering is a plain map, not a virtualized list. Fine for a day,
  needs `FlashList` for long histories.
