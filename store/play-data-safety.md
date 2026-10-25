# Google Play — Data safety form answers

Every answer below was checked against the code, with the file that proves
it. Play can remove an app whose declaration does not match its behaviour,
so nothing here is guessed.

**Encryption in transit:** YES for everything. All traffic goes to Supabase
and the three outside APIs over HTTPS.

**Deletion:** YES for everything. Profile → *Delete my account* calls the
`delete-account` function, which removes the account, its rows and its
stored photos.

---

## Does your app collect or share any of the required user data types?

**YES.**

---

## Personal info

### Email address — **COLLECTED**

| Question | Answer |
|---|---|
| Collected | Yes |
| Shared | No |
| Processed ephemerally | No, it is stored |
| Required or optional | **Required** - the app has no guest mode |
| Purpose | **Account management** |

*Why:* sign-up and sign-in go through Supabase Auth
(`src/features/auth/service.ts`).

### Name — **NOT COLLECTED**

Your display name is kept on the device and never sent. `profiles.display_name`
exists in the database but no code writes it; the only column the app writes
on `profiles` is `avatar_url` (`src/features/profile/avatar.ts`).

### Other personal info (profile picture) — **COLLECTED, OPTIONAL**

| Question | Answer |
|---|---|
| Collected | Yes, only if you set one |
| Shared | No |
| Required or optional | **Optional** |
| Purpose | **App functionality** - showing you your own picture |

---

## Photos and videos

### Photos — **COLLECTED and SHARED**

| Question | Answer |
|---|---|
| Collected | Yes |
| Shared | **Yes** - with the AI provider that identifies the food |
| Processed ephemerally | **Yes**, unless you turn on "Keep my meal photos" |
| Required or optional | **Optional** - you can log food without photographing it |
| Purpose | **App functionality** |

*Why "shared":* the image is sent to Google's Gemini API to be identified
(`supabase/functions/_shared/vision.ts`). Play counts a transfer to another
company as sharing.

*Why "ephemeral":* the photo is stored only when `retainPhoto` is true
(`supabase/functions/analyze-meal/index.ts`), and that setting is off by
default (`src/store/preferencesStore.ts`). Turning it off deletes the copies
already kept, on the device and in the account
(`src/features/photos/storedPhotos.ts`).

---

## Health and fitness

### Health info — **COLLECTED**

| Question | Answer |
|---|---|
| Collected | Yes |
| Shared | No |
| Required or optional | **Optional** - nothing forces you to log |
| Purpose | **App functionality** |

*What:* the meals and foods you log with their nutrition, your water intake
and your weight entries - `food_entries`, `food_entry_items`,
`water_entries`, `weight_entries`.

### Fitness info — **NOT COLLECTED**

The app tracks no exercise, no steps, and connects to no wearable.

---

## App activity

### Other actions — **COLLECTED**

| Question | Answer |
|---|---|
| Collected | Yes |
| Shared | No |
| Required or optional | Required |
| Purpose | **App functionality** - enforcing the daily AI limits |

*What:* one row per AI request with the outcome, which model answered, how
long it took and the size of what was sent (`scan_events`). It holds neither
the photograph nor the meal description.

### App interactions, search history, installed apps — **NOT COLLECTED**

---

## Everything else — **NOT COLLECTED**

Location · Financial info · Messages · Contacts · Calendar · Files and docs ·
Audio · Web browsing · Device IDs · Crash logs · Diagnostics ·
Advertising data

The app contains **no analytics, advertising or tracking library** - checked
against `package.json`. The only Android permission it requests is
`android.permission.CAMERA`.

---

## Data safety — summary to expect on your listing

> **Data shared with third parties:** Photos and videos
> **Data collected:** Email address, Photos, Health info, App activity
> **Data is encrypted in transit:** Yes
> **You can request that data be deleted:** Yes

---

## App access (a separate section, and the one apps fail on)

The app has **no guest mode** - `app/(auth)/welcome.tsx` offers only
*Sign In* and *Create Account*. A reviewer who cannot sign in will reject
the app.

In **App access**, choose *All functionality is restricted* and give a demo
account's email and password. Log a few meals on it first, so the reviewer
sees a working app rather than an empty one.
