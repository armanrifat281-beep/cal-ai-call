# Privacy Policy — FoodLens AI

**Last updated: 23 October 2026**

FoodLens AI is a food and nutrition journal. This policy explains what the
app collects, where it goes, and how to get rid of it. It describes the app
as it is actually built.

Contact: **[PUT YOUR CONTACT EMAIL HERE]**

---

## What the app collects

**Your account.** An email address and a password, so your journal can
follow you to another phone. Passwords are handled by our authentication
provider and are never visible to us.

**Your profile.** A display name, if you give one, and a profile picture, if
you choose one.

**What you log.** The meals and foods you record, their portions and times,
and the water and weight you enter.

**Your preferences.** Your goal and daily targets, dietary patterns, any
allergens you choose to tell us about, the ingredients in your kitchen list,
and your choice of units.

**What you create.** Recipes you generate or save, and your shopping lists.

**A record of AI use.** For each photo analysis or recipe generation we store
the outcome, which model answered, how long it took, and the size of what was
sent. This is what enforces the daily limits. It does not contain the photo.

## What the app does not collect

The app contains **no analytics, advertising or tracking software of any
kind**. There is no third-party SDK watching how you use it.

It does not ask for or collect your location, contacts, calendar, or
microphone. It does not build an advertising profile, and it does not sell
or share your data for advertising. Nothing is sold to anyone.

## Photographs

This is the part worth reading carefully.

When you photograph a meal, the image is sent to **Google's Gemini API** so
it can be identified. Google processes the image to answer that request.

**The photo is not kept on our servers** unless you turn on *Keep my meal
photos* in the app. That setting is **off by default**. With it off, the
image is used for the analysis and not stored. With it on, the photo is
saved to your own private folder, readable only by your account, and turning
the setting back off deletes the photos already kept.

Photos you take are also kept on your own phone so the app can show them to
you. Those never leave the device.

The camera permission is used for photographing meals and reading barcodes.
The photo library permission is used only when you pick an existing picture.

## Who else receives anything

| Service | What it receives | Why |
|---|---|---|
| **Supabase** | Your account and everything you log | Hosts the database, accounts and file storage |
| **Google (Gemini API)** | Meal photos and meal descriptions you submit | Identifies the food and estimates nutrition |
| **USDA FoodData Central** | The words you type into food search | Returns nutrition records |
| **Open Food Facts** | The barcode you scan | Returns the product's published nutrition |

USDA and Open Food Facts receive only the search text or the barcode. They
are not told who you are.

## Where your data is stored

On servers operated by Supabase in **Mumbai, India (ap-south-1)**.

Every table is protected so that your rows are readable only by your own
account. This is enforced by the database itself, not only by the app.

## Deleting your data

**In the app:** Profile → *Delete my account*. This deletes your account and
the data stored against it, including any kept photos.

**On the device only:** Profile → *Delete everything on this device* clears
the local copy without touching your account.

If you cannot reach the app, email the address at the top of this policy and
ask for your account to be deleted.

## Children

FoodLens AI is not directed at children and is not intended for anyone under
13. We do not knowingly collect data from children. If you believe a child
has given us data, email us and we will delete it.

## Your rights

Depending on where you live, you may have the right to ask for a copy of
your data, to correct it, or to have it deleted. Email the address above and
we will respond.

## Changes

If this policy changes, the date at the top changes with it, and the new
version replaces this page.
