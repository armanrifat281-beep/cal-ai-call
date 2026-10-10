import { useRouter } from 'expo-router';

import { Article, type ArticleSection } from '@/components/Article';
import { Icon } from '@/components/Icon';
import { Disclosure, Row, Screen, Section, Surface } from '@/components/ui';
import { describeMissingConfig, env } from '@/lib/env';

/**
 * Help.
 *
 * Answers to the questions this app actually raises, rather than a support
 * form pointing at an inbox that does not exist. The questions were chosen
 * from the things the app does that are genuinely surprising: that the
 * numbers are estimates, that a photo is thrown away by default, and that
 * nothing syncs until you sign in.
 */
const SECTIONS: ArticleSection[] = [
  {
    heading: 'Why are the numbers estimates?',
    body: [
      'A photograph shows what food looks like, not what it weighs or what went into the pan. The model reads the picture and gives its best reading of the portion and the ingredients.',
      'Every item says where its numbers came from. Anything marked as an estimate can be edited: open the meal, tap the food, and correct the portion or the figures. What you type is kept as yours and is never overwritten.',
    ],
  },
  {
    heading: 'How do I get a better reading?',
    points: [
      'Photograph the whole plate from above, so nothing is hidden behind anything else.',
      'Use daylight where you can. A dim photo loses the detail the model needs.',
      'Keep something familiar in frame - a fork, a standard plate - and portions are judged better.',
      'Photograph before you start eating, not halfway through.',
    ],
  },
  {
    heading: 'Where are my meals kept?',
    body: [
      'On this phone, until you sign in. That means they are private and they work offline, and it also means an uninstall takes them with it.',
      'Signing in copies them to your account so they survive a lost phone and appear on your other devices.',
    ],
  },
  {
    heading: 'What happened to my photo?',
    body: [
      'By default it is read and then discarded. "Keep my meal photos" in Settings keeps it with the meal instead, on this device.',
      'A photo you take of a dish after cooking it is kept with that recipe, separately, and is not affected by that setting.',
    ],
  },
  {
    heading: 'Why does my daily ring look empty?',
    body: [
      'The ring fills against your energy target. With no target set there is nothing to be a fraction of, so it shows the make-up of the day instead and fills completely.',
      'Set a target under Goal in Settings and it becomes a progress ring.',
    ],
  },
  {
    heading: 'Can I log something without a photo?',
    body: [
      'Yes, and it is often quicker. "Add a meal" on the Home screen opens the same editor with nothing filled in. Meals you have logged before can be copied to today from the meal itself.',
    ],
  },
];

export default function HelpScreen() {
  const router = useRouter();

  return (
    <Screen edges={{ bottom: true }}>
      <Article sections={SECTIONS} />

      <Section title="More" dense>
        <Surface variant="grouped">
          <Row
            title="What FoodLens does with your data"
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/settings/privacy')}
          />
          <Row
            title="Terms of use"
            divided
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/settings/terms')}
          />
        </Surface>
      </Section>

      {!env.isSupabaseConfigured ? (
        <Disclosure
          summary="Photo analysis and accounts are not set up in this build"
          detail={`Missing: ${describeMissingConfig().join(
            '; ',
          )}. Logging meals by hand, editing them, saved recipes and shopping lists all work without it.`}
        />
      ) : null}

      <Disclosure
        summary="There is no support contact yet"
        detail="No support address or help site is configured for this build, so there is deliberately nothing here that looks like a contact form and quietly goes nowhere. Once one exists it belongs on this screen."
      />
    </Screen>
  );
}
