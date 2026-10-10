# Setup

What you can run today, and what needs an account somewhere.

## 1. Run the app (no accounts needed)

```bash
npm install
npm start
```

Then press `i` for an iOS simulator, `a` for Android, or scan the QR code with
the Expo Go app on a real phone.

In this mode the app is fully usable: onboarding, manual meal logging, editing,
duplicating, the journal, daily summaries, and Food Memory insights all work.
Meals are stored on the device and the UI says so. Photo capture works too; only
the analysis step is unavailable.

### If you want a native build

Expo Go is enough for everything above. You need a development build only for
things Expo Go cannot do, such as Sign in with Apple:

```bash
npx expo run:ios       # requires the full Xcode, not just Command Line Tools
npx expo run:android   # requires Android Studio and a JDK
```

## 2. Checks you can run now

```bash
npm test             # 180 Jest tests
npm run typecheck    # TypeScript, strict mode
./scripts/test-db.sh # applies the migrations and tests RLS on a temp Postgres
```

`test-db.sh` needs PostgreSQL installed locally (`brew install postgresql@17`
on macOS). It does not need Docker or a Supabase project.

## 3. Supabase (needed for accounts, sync and photo analysis)

**Every step here needs you: it involves creating accounts, and I cannot do
that on your behalf.** Work through them in order.

### 3.1 Create the project

1. Sign up at [supabase.com](https://supabase.com) and create a project. Pick a
   region close to your users; it cannot be changed later.
2. Go to **Project Settings -> API Keys** and copy:
   - the **Project URL** (`https://<ref>.supabase.co`)
   - the **publishable key** (`sb_publishable_...`)
3. Create `.env` from the template and paste both in:

   ```bash
   cp .env.example .env
   ```

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

4. Restart the dev server. These values are inlined at build time, so a running
   server will not pick them up.

> **Do not paste the secret key.** On the same page there is a `sb_secret_...`
> key (older projects call it `service_role`). It bypasses Row Level Security.
> In an `EXPO_PUBLIC_` variable it ships inside the app where anyone can read
> it, which would expose every user's data. The app classifies the key you give
> it, refuses to use a privileged one, and tells you to rotate it.

### 3.2 Apply the schema

```bash
npm install --save-dev supabase
npx supabase login
npx supabase link --project-ref your-ref
npx supabase db push
```

`db push` applies the nine migrations in `supabase/migrations/`, which create:

| Table | Holds |
| --- | --- |
| `profiles` | one row per user, created automatically at sign-up |
| `user_preferences` | language, region, units, goals, privacy choices |
| `food_entries` | logged meals |
| `food_entry_items` | the foods inside a meal, with per-item provenance |
| `saved_meals` | meal snapshots for one-tap re-logging |
| `saved_recipes` | recipes: ingredients, steps, servings |
| `shopping_lists` / `shopping_list_items` | shopping lists |
| `food_insights` | cached Food Memory insights, server-written only |
| `scan_events` | one row per analysis attempt; drives the scan limit |
| `subscription_entitlements` | server-verified entitlements, client-readable only |

**Do not apply `supabase/tests/00_local_supabase_shim.sql`.** It exists only to
emulate Supabase on a local Postgres for the RLS tests. On a real project it
would collide with the platform's own `auth` and `storage` schemas.

Before pushing, you can verify the schema locally without any account:

```bash
./scripts/test-db.sh
```

That applies every migration to a throwaway Postgres and then attacks the
policies from another user's session.

### 3.3 Verify RLS is on

In the dashboard, open **Table Editor** and confirm every table shows "RLS
enabled". If any table does not, stop and say so: an unprotected table is
readable by every user of the app.

### 3.4 Manual dashboard settings

These cannot be set from a migration:

- **Email auth**: Authentication -> Providers -> Email. Decide whether to
  require email confirmation. Turn it **on** for production.
- **Redirect URLs**: Authentication -> URL Configuration. Add `foodlens://` so
  email confirmation and password reset links return to the app.
- **Email templates**: Authentication -> Email Templates. The defaults mention
  Supabase; edit them before any real user sees one.
- **Storage**: the `meal-photos` bucket is created by a migration and is
  private. Confirm under Storage that it is **not** public.
- **Sign in with Apple** (optional): needs an Apple Developer Program
  membership (USD 99/year), a Service ID and a key. Requires a development
  build; it does not work in Expo Go.
- **Google sign-in** (optional): needs a Google Cloud project with OAuth client
  IDs for iOS and Android.

## 4. Photo analysis with Claude

The Edge Function is written (`supabase/functions/analyze-meal/`). It has never
run against the live API, because that needs your key and a deploy.

### 4.1 Get an Anthropic API key

1. Sign up at [console.anthropic.com](https://console.anthropic.com).
2. Add credit. This is usage-based and will be your main running cost.
3. Create an API key (`sk-ant-...`).

### 4.2 Store it as a secret, not in `.env`

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key
```

Secrets set this way are readable only inside Edge Functions. The key never
reaches the device, and the app never calls Anthropic directly.

### 4.3 Deploy

```bash
npx supabase functions deploy analyze-meal
npx supabase functions deploy delete-account
```

`delete-account` needs no secret of its own: Supabase injects the service role
key into Edge Functions automatically. It exists because a client cannot delete
its own auth user, and it takes the user id from the verified access token, not
from the request body, so a signed-in caller cannot delete anyone else.

### 4.4 Check it actually works

```bash
npx supabase functions logs analyze-meal
```

Then take a photo in the app. A successful request writes a row to
`scan_events` with `outcome = 'succeeded'`. Until you see that row, the
integration is not working, whatever the app appears to do.

### What the function does

- Authenticates the caller against Supabase auth.
- Checks the rolling 24-hour scan allowance server-side (free: 5, premium:
  100). A client cannot write `scan_events`, so it cannot reset its own quota.
- Validates the image by reading its **magic bytes**, not the content type the
  client claims. Max 5 MB.
- Calls Claude Opus 5.5 with the photo, constrained to a JSON schema.
- Validates the response against value ranges a schema cannot express, because
  a schema cannot stop a model returning 50,000 calories for an apple.
- Records the attempt either way, so a failure still costs allowance.
- Stores the photo only if the user turned retention on. Otherwise the bytes
  exist only in memory for the length of the request.

Only the hour of day and an optional country code are sent alongside the
photo. No name, no email, and never the allergy list.

### Known limitation

Food database matching is **not implemented**. Every scanned item therefore
comes back as an AI estimate, and the app asks the user to confirm every one.
This is the honest behaviour, not a bug, but it means scanned numbers are
rougher than they will be once USDA lookup lands.

## 5. What will cost money

| Thing | Cost |
| --- | --- |
| Expo Go, local development | Free |
| Supabase | Free tier is enough to start |
| USDA FoodData Central | Free |
| Anthropic API (photo analysis) | Per image; the main running cost |
| Apple Developer Program | USD 99/year, required to ship on iOS |
| Google Play Console | USD 25 one-off |
| EAS Build | Free tier available, paid for faster builds |

## 6. Decisions still needed

- The product name, and whether the trademark is free.
- A real bundle identifier. It is currently `com.example.foodlensai` in
  `app.json` and must be changed before any store submission.
- Whether to require email confirmation at sign-up.
- Whether the free tier's 5 scans a day is the right number. It lives in
  `scan_limit_for_tier()` in the database, so changing it needs no app update.
