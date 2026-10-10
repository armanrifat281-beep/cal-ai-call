import { Article, type ArticleSection } from '@/components/Article';
import { Disclosure, Screen } from '@/components/ui';
import { env } from '@/lib/env';

/**
 * What the app does with the user's data.
 *
 * Written from the code rather than from a template: every claim here is
 * checkable against the app, and the two paragraphs that change depending on
 * whether a backend is configured actually change.
 */
function sections(backendConfigured: boolean): ArticleSection[] {
  return [
    {
      body: [
        'FoodLens keeps as little as it can, in as few places as possible. This page describes what the app actually does, not what a category of app usually does.',
      ],
    },
    {
      heading: 'What stays on your phone',
      body: [
        backendConfigured
          ? 'Until you sign in, everything is on this device alone: your meals, recipes, shopping lists, preferences and targets. Nothing is uploaded and nothing is backed up, which also means that deleting the app deletes them.'
          : 'This build has no account backend configured, so everything is on this device alone: your meals, recipes, shopping lists, preferences and targets. Nothing is uploaded and nothing is backed up, which also means that deleting the app deletes them.',
        'Photos you keep with a meal, and photos you take of a dish you cooked, are stored in the app’s own folder on this device. They are never uploaded and never sync to another device, because a file path on one phone means nothing on another.',
      ],
    },
    {
      heading: 'What leaves your phone',
      body: [
        'Only two things ever leave this device, and only when you ask for them.',
      ],
      points: [
        'A meal photo you choose to analyse. It is sent to our own server, which passes it to Anthropic’s Claude to be read. What goes with it is the photo, the hour of the day, and an optional region hint so portions are judged sensibly. Your name, email, targets, allergens and food history are not sent.',
        'A recipe request you write. The dish, servings, equipment, time and any ingredients you listed are sent the same way. Your journal is not.',
      ],
    },
    {
      heading: 'The photo you analysed',
      body: [
        'By default the photo is read and then discarded on the server; nothing is stored. "Keep my meal photos" in Settings changes that, and the page says so before you turn it on.',
        'Turning it back off deletes the photos already kept, not only future ones.',
      ],
    },
    {
      heading: 'If you have an account',
      body: [
        'Signing in moves your meals, recipes and lists to our database so they survive a lost phone. Every row is restricted to the account that created it, enforced by the database itself rather than by the app asking politely.',
        'Your sign-in tokens are held in the device keychain on iOS and the Keystore on Android, not in ordinary app storage.',
      ],
    },
    {
      heading: 'What we do not do',
      points: [
        'No analytics, no tracking, no advertising identifiers, and no third-party SDKs that collect anything. There are none in the app to disable.',
        'Nothing is sold or shared with anyone beyond the two services named above.',
        'No notifications are sent. The app has no notification permission to ask for.',
      ],
    },
    {
      heading: 'Removing it',
      body: [
        '"Delete everything on this device" in Settings clears your meals, recipes, lists, photos and preferences from this phone.',
        'If you have an account, "Delete my account" removes the account and everything stored against it, starting with your photos. It cannot be undone and it is not a deactivation.',
      ],
    },
    {
      heading: 'Health',
      body: [
        'FoodLens is not a medical device and gives no medical or dietary advice. Nutrition figures are estimates, and a photograph cannot show hidden oil, sugar or exact weight.',
      ],
    },
  ];
}

export default function PrivacyScreen() {
  return (
    <Screen edges={{ bottom: true }}>
      <Article
        note="Last reviewed 10 October 2026. This describes the app as built."
        sections={sections(env.isSupabaseConfigured)}
      />
      <Disclosure
        summary="This is a plain-language description, not a filed policy"
        detail="It is accurate about what the app does, and it is written from the code. A published app also needs a privacy policy reviewed against the law where it ships and the app store's own requirements. That review has not happened."
        tone="caution"
      />
    </Screen>
  );
}
