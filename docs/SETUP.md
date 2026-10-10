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

**This requires you to create an account and is not something the code can do
for itself.**

### 3.1 Create the project

1. Sign up at [supabase.com](https://supabase.com) and create a project.
2. Copy the URL and the **anon** key from **Project Settings -> API**.
3. Put them in `.env`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

   Restart `npm start` afterwards: these are inlined at build time.

   The anon key is meant to be public. The **service role** key is not: never
   put it in `.env`, in `app.json`, or anywhere the app can read.

### 3.2 Apply the schema

Install the CLI and link the project:

```bash
npm install --save-dev supabase
npx supabase login
npx supabase link --project-ref your-ref
npx supabase db push
```

`db push` applies everything in `supabase/migrations/`. Do **not** apply
`supabase/tests/00_local_supabase_shim.sql`: it exists only to emulate Supabase
locally, and on a real project it would collide with the platform's own `auth`
and `storage` schemas.

After pushing, check in the dashboard that **Authentication -> Policies** shows
RLS enabled on all seven tables.

### 3.3 Manual dashboard steps

These cannot be done from a migration:

- **Email auth**: Authentication -> Providers -> Email. Decide whether to
  require email confirmation (recommended for production).
- **Redirect URLs**: Authentication -> URL Configuration. Add `foodlens://` so
  the app's deep links work after email confirmation and OAuth.
- **Sign in with Apple**: needs an Apple Developer Program membership
  (USD 99/year), a Service ID, and a key. Requires a development build; it does
  not work in Expo Go.
- **Google sign-in**: needs a Google Cloud project with OAuth client IDs for iOS
  and Android.
- **Storage**: the `meal-photos` bucket is created by a migration and is
  private. Confirm under Storage that it is not public.

## 4. Photo analysis (not built yet)

The app's client for this is written (`src/features/scanner/service.ts`), and it
validates whatever it receives. The server side does not exist yet, so the
scanner screen says analysis is unavailable rather than showing invented data.

What it will need:

- An Edge Function at `supabase/functions/analyze-meal`.
- A key for a vision-capable AI provider, set as a secret:

  ```bash
  npx supabase secrets set VISION_API_KEY=...
  ```

- A USDA FoodData Central key, free from
  [fdc.nal.usda.gov/api-key-signup](https://fdc.nal.usda.gov/api-key-signup.html):

  ```bash
  npx supabase secrets set USDA_FDC_API_KEY=...
  ```

Secrets set this way are readable only inside Edge Functions. They never reach
the device.

## 5. What will cost money

| Thing | Cost |
| --- | --- |
| Expo Go, local development | Free |
| Supabase | Free tier is enough to start |
| USDA FoodData Central | Free |
| Vision model API | Per image; the main running cost |
| Apple Developer Program | USD 99/year, required to ship on iOS |
| Google Play Console | USD 25 one-off |
| EAS Build | Free tier available, paid for faster builds |

## 6. Decisions still needed

- The product name, and whether the trademark is free.
- A real bundle identifier. It is currently `com.example.foodlensai` in
  `app.json` and must be changed before any store submission.
- Which vision provider to use.
- Whether to require email confirmation at sign-up.
