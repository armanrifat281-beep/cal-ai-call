# FoodLens AI

An AI nutrition assistant for Android and iOS: photograph a meal, get an
estimate of what is in it, correct anything that looks wrong, and keep a food
journal that learns which meals you actually eat.

Built with React Native, Expo and TypeScript. Backend on Supabase.

> **Working name.** "FoodLens AI" is a placeholder. Check trademark
> availability before using it publicly.

## What the app refuses to do

These are design rules, not aspirations, and they are enforced in code:

- **An estimate is never shown as a measurement.** Every nutrition figure
  carries its source (`From food database`, `AI estimate`, `You entered this`)
  and estimates carry a confidence level.
- **Unknown is not zero.** A missing nutrient is stored and displayed as
  unknown, and any total containing one is labelled incomplete rather than
  quietly undercounted.
- **A portion is never guessed.** If "1 cup" of a food has no known weight, the
  app asks instead of inventing a number.
- **An insight must cite its evidence.** Every Food Memory insight records which
  journal entries it was computed from and how, and the UI can show both. The
  database rejects an insight that cannot.
- **No fake backends.** Features that need credentials say so plainly instead of
  showing invented data.

## Current state

| Area | State |
| --- | --- |
| Project foundation, theming, light/dark | Working |
| Onboarding (4 steps, all skippable) | Working |
| Manual meal logging, editing, deleting, duplicating | Working |
| Food journal with day navigation and daily summaries | Working |
| Nutrition engine (portions, scaling, totals, goals) | Working, unit tested |
| Food Memory insights from saved records | Working, unit tested |
| In-app camera, validation, compression | Working |
| Database schema, RLS policies | **Deployed and verified against the live project** |
| Email authentication | **Working against the live project** |
| Supabase journal repository | **Working against the live project** |
| Account deletion | **Deployed and verified** |
| Photo analysis (Claude) | Deployed and wired to the UI. **Needs `ANTHROPIC_API_KEY`**; returns 503 until it is set |
| AI Recipe Creator | Deployed, with a labelled demo fallback. **Needs `ANTHROPIC_API_KEY`** |
| Cooking mode, ingredient checklist, serving adjustment | Working |
| Shopping lists | Working |
| Sign in with Google | Built. Provider not enabled on the project, and the button says so |
| Sign in with Apple | **Removed.** This app ships on Android; Apple's provider needs a paid membership |
| Recipe images | **Not built.** A labelled placeholder is drawn instead |
| Food database lookup (USDA) | **Not built.** Types exist; no search screen or provider |
| Subscriptions | Schema only, deliberately unused |
| Email delivery | **Supabase's built-in sender only: 2 messages an hour.** Confirmation is currently off so the app can be tested; custom SMTP is needed before release |

Until Supabase is configured the app runs in a clearly labelled device-only
mode: meals are saved to the device with real persistence, and the UI says they
are not backed up. Nothing is mocked.

## Getting started

Requires Node 20+ and the Expo Go app, or a simulator.

```bash
npm install
cp .env.example .env     # optional: the app runs without it
npm start
```

Press `i` for an iOS simulator, `a` for Android, or scan the QR code with Expo
Go. See [docs/SETUP.md](docs/SETUP.md) for the full environment and Supabase
setup, including what needs doing by hand in the dashboard.

## Checks

```bash
npm test                   # Jest: 578 unit and component tests
npm run typecheck          # TypeScript, strict, the app
npm run typecheck:functions # TypeScript, strict, the Edge Functions' pure modules
npm run check              # all of the above
./scripts/test-db.sh       # 133 assertions against a throwaway Postgres
```

`scripts/test-db.sh` needs a local `postgres` install but no Docker and no
Supabase project: it spins up a temporary cluster, emulates the Supabase `auth`
and `storage` pieces, applies every migration, then tries to read and write
another user's data to prove the policies hold.

## Layout

```
app/                      Expo Router routes (the screens)
  (onboarding)/           Welcome, basics, food preferences, goals, privacy
  (auth)/                 Sign in, sign up, password reset
  (tabs)/                 Home, Scan, Recipes, Journal, Settings (+ Insights)
  entry/                  Create and edit a meal
  recipe/                 Create, view, and cook a recipe
  shopping/               Shopping lists
src/
  components/ui/          Design system primitives
  components/nutrition/   Nutrition display components
  features/
    nutrition/            Portion conversion, nutrient maths, formatting
    journal/              Repository contract, local store, meal editor
    memory/               Food Memory insight generation
    scanner/              Image preparation, response validation, API client
    recipes/              Generation, scaling, validation, storage
    onboarding/           Onboarding options and step layout
  lib/                    Dates, ids, errors, logging, config
  store/                  Preferences (persisted on device)
  theme/                  Tokens, palette, ThemeProvider
  types/                  Domain types, mirroring the database schema
supabase/
  migrations/             Schema, constraints, RLS policies
  tests/                  Local Postgres harness and RLS tests
docs/                     Setup, architecture, release notes
scripts/                  Development scripts
```

## Architecture notes

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the reasoning. The short
version:

- **Food recognition is separate from nutrient calculation.** The vision model
  says what it sees; the nutrition engine turns that into numbers. Either side
  can be replaced without touching the other.
- **Providers are behind interfaces.** `JournalRepository` has a device-local
  and (later) a Supabase implementation; the screens know neither.
- **The nutrition engine is pure.** No network, no React, no device APIs, so it
  is tested exhaustively and cheaply.
- **Provider secrets never reach the device.** The app talks to our own Edge
  Function, which holds the AI and food-database keys.
- **RLS is the security boundary.** Client-side filtering is a convenience.

## Licence

Not yet chosen. Add one before publishing.
