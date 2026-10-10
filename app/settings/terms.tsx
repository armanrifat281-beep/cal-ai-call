import { Article, type ArticleSection } from '@/components/Article';
import { Disclosure, Screen } from '@/components/ui';

/**
 * Terms of use.
 *
 * A draft, and labelled as one. Writing something that reads like binding
 * terms when nobody has reviewed it would be worse than the empty row this
 * replaces, so the caveat is part of the screen rather than a footnote.
 */
const SECTIONS: ArticleSection[] = [
  {
    heading: 'What FoodLens is',
    body: [
      'FoodLens estimates what is in a meal from a photograph, keeps a journal of what you have eaten, and writes recipes. It is a tool for keeping track of your own food.',
    ],
  },
  {
    heading: 'It is not health advice',
    body: [
      'FoodLens is not a medical device, and nothing in it is medical, nutritional or dietary advice. It does not diagnose, treat or prevent anything.',
      'If you are managing a condition, an allergy, a pregnancy, or anything else where what you eat matters clinically, talk to a qualified professional. Do not substitute this app for that.',
    ],
  },
  {
    heading: 'The numbers are estimates',
    body: [
      'Figures that come from a photograph are produced by a model reading an image. It cannot see the oil in the pan, the sugar in the sauce, or what anything weighs. Every figure is labelled with where it came from, and every one can be corrected.',
      'Treat them as estimates. Decisions that need accuracy need a scale and a label.',
    ],
  },
  {
    heading: 'Allergens',
    body: [
      'Listing an ingredient to avoid filters recipe text and model output. That is a convenience, not a safety check, and it can be wrong in both directions. Always read the actual label on the actual food.',
    ],
  },
  {
    heading: 'Your account and your content',
    body: [
      'You are responsible for keeping your password to yourself. Your meals, recipes and photos remain yours; using the app does not give anyone a licence to them beyond what is needed to store them for you and to run the analysis you asked for.',
      'You may delete your account at any time from Settings, and that removes what is stored against it.',
    ],
  },
  {
    heading: 'Availability',
    body: [
      'Photo analysis and recipe writing depend on a third-party model and on a server. Either can be slow, unavailable, or wrong. The journal, the editor and your saved recipes keep working without them.',
    ],
  },
];

export default function TermsScreen() {
  return (
    <Screen edges={{ bottom: true }}>
      <Article note="Draft, 10 October 2026." sections={SECTIONS} />
      <Disclosure
        summary="These terms are a draft and have not been reviewed"
        detail="They describe the intent honestly, but they are not a lawyer's work and they are not binding on anyone. Terms have to be written and reviewed for the places the app ships before release. Nothing here should be relied on as a legal agreement in the meantime."
        tone="caution"
      />
    </Screen>
  );
}
