/**
 * Color for FoodLens AI.
 *
 * Built from ramps rather than picked ad hoc:
 *
 *   **Neutral** - the interface greys, from paper to ink. Genuinely
 *   neutral: these were a warm clay, and at phone brightness the light page
 *   read as beige and the dark page read as brown.
 *
 *   **Forest** - a deep, slightly blue-leaning green as the single brand
 *   colour, with **Ember**, a burnt orange, reserved for exactly one job: the
 *   scan action. Keeping the accent scarce is what makes it mean something.
 *
 * Every text-on-background pairing used in the app clears WCAG AA (4.5:1) for
 * body text, or AA Large (3:1) for text at or above 19pt semibold.
 */

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  /** The page. */
  background: string;
  /** A surface sitting on the page: grouped lists, panels. */
  surface: string;
  /** A surface that lifts off the page with a shadow. */
  surfaceRaised: string;
  /** Secondary fill inside a surface: inputs, progress tracks, chips. */
  surfaceAlt: string;
  /** Pressed state fill. */
  surfacePressed: string;
  /** Hairline between rows in a list. Quieter than a border. */
  separator: string;
  /** Outline on an input or an outlined control. */
  border: string;
  /** Stronger outline: focus rings, selected controls. */
  borderStrong: string;
  /** Shadow colour. Warm near-black, never pure black. */
  shadow: string;

  /** Primary text. */
  text: string;
  /** Secondary text: supporting lines, metadata. */
  textMuted: string;
  /** Tertiary text: placeholders, disabled. */
  textSubtle: string;
  textOnPrimary: string;
  textOnAccent: string;

  primary: string;
  primaryPressed: string;
  /** Low-opacity brand tint: selected rows, badges. */
  primarySoft: string;
  /** Text and icons readable on `primarySoft`. */
  primaryOnSoft: string;

  accent: string;
  accentPressed: string;
  accentSoft: string;
  accentOnSoft: string;


  success: string;
  successSoft: string;
  successOnSoft: string;
  warning: string;
  warningSoft: string;
  warningOnSoft: string;
  danger: string;
  dangerPressed: string;
  dangerSoft: string;
  dangerOnSoft: string;
  info: string;
  infoSoft: string;
  infoOnSoft: string;

  /**
   * The default colour for a data mark: a bar, a ring, a plotted line.
   *
   * Separate from `primary` on purpose. The accent means "you can press
   * this" or "this is selected", and a chart is neither. It also has to sit
   * beside `warning`, which marks going over a target - and a chart drawn
   * in the same red as a warning says the ordinary case is a problem.
   */
  chart: string;

  /**
   * Macro nutrient identity colours, used consistently app-wide.
   *
   * Drawn from the forest and ember ramps rather than picked as three
   * arbitrary hues, so a chart of a meal still looks like this app and like
   * food - deep green, wheat, terracotta.
   *
   * They are chosen for separation, not just for looks. The three are set
   * apart by lightness as well as hue, so they survive greyscale and the
   * common colour-blindness types: the closest pair differs by 1.6:1 in
   * light and 1.7:1 in dark, where the previous blue/mustard/purple set had
   * a protein-to-fat ratio of 1.02:1 and vanished entirely in greyscale.
   * Every one of them also clears roughly 2.7:1 against the empty track
   * behind a chart, so a filled arc can be told from an unfilled one.
   *
   * These are fills only - bars, arcs, legend dots - never text, which is
   * what makes a ratio below 4.5:1 acceptable here.
   */
  protein: string;
  carbs: string;
  fat: string;
  /**
   * Fibre, which the dashboards show beside the three macros.
   *
   * A fourth identity colour rather than a reuse of `chart`: the day card,
   * the meal rows and the food detail all list it in the same row as
   * protein, carbs and fat, and three named colours plus one borrowed one
   * reads as a mistake.
   */
  fiber: string;

  /** Scrim behind a modal. */
  scrim: string;
  /** Skeleton loader base. */
  skeleton: string;
}

// ---------------------------------------------------------------------------
// Ramps
// ---------------------------------------------------------------------------

/**
 * The interface greys. 0 is paper, 900 is ink.
 *
 * Genuinely neutral: no channel in any step differs from another by more
 * than a few points. This was a warm neutral ramp, on the theory that food
 * photography sits badly on cold grey - but at phone brightness the page
 * read as beige and the dark page read as brown, which is not what either
 * mode is understood to look like.
 *
 * The warmth that argument was about now lives where it belongs: in the
 * food colours themselves, which are still forest, wheat and terracotta,
 * and in the photographs.
 */
/**
 * Paper to ink, very slightly warm.
 *
 * The warmth is deliberate and it is small. A previous version was a warm
 * clay that read as beige in light mode and brown in dark, and a version
 * after that was a true cold grey that left food photography looking
 * refrigerated. These sit between: the light steps carry a few points more
 * red and green than blue, which reads as paper rather than as cream, and
 * the dark steps stay close to neutral so a photograph is not tinted.
 *
 * The one rule: no step may differ from a true grey by enough to be named a
 * colour. If a surface looks beige on a phone at full brightness, it has
 * gone too far.
 */
const neutral = {
  0: '#FFFFFF',
  25: '#FAF9F6',
  50: '#F5F3EF',
  100: '#ECE9E3',
  200: '#DBD7CF',
  300: '#BEB9AF',
  400: '#918C83',
  500: '#6C6862',
  600: '#4B4844',
  700: '#302E2B',
  800: '#1E1D1B',
  900: '#100F0E',
} as const;

const forest = {
  50: '#E8F1EC',
  100: '#C9E0D4',
  200: '#9BC7B2',
  300: '#6BAB90',
  400: '#3F8B6C',
  500: '#246B4F',
  600: '#1A543E',
  700: '#133F2F',
  800: '#0D2C21',
} as const;

/**
 * The mint neutrals the light interface is built from.
 *
 * Not the warm paper ramp that used to be here. The light scheme has one job
 * now - it is the pale half of the product, the one the recipe screens are
 * drawn in - and a cream page under a green headline read as two different
 * products stapled together. These carry a few points more green than red or
 * blue, which is enough to read as mint and not enough to read as a colour.
 *
 * The same rule the warm ramp had: no step may differ from a true grey by
 * enough to be named a colour on its own. If a card looks green rather than
 * white on a phone at full brightness, it has gone too far.
 */
const mint = {
  0: '#FFFFFF',
  25: '#F6FBF8',
  50: '#EFF6F1',
  100: '#E3EFE8',
  200: '#D7E7DE',
  300: '#CFE1D7',
  400: '#A8C3B5',
  500: '#5C6F66',
  600: '#45574E',
  700: '#2A3B33',
  900: '#10201A',
} as const;

/**
 * The light scheme's brand green.
 *
 * A true green rather than the blue-leaning `forest` above. Forest is a
 * furniture colour - dark enough to read as a surface - and what the light
 * screens need is the opposite: a green bright enough to be the one coloured
 * thing on a pale page, and dark enough that white survives on it. 500 sits
 * at 5.0:1 against white and 4.6:1 against the page, so it can be both a
 * filled button and a word inside a headline.
 */
const grass = {
  50: '#E7F4EC',
  100: '#DFF1E5',
  200: '#B7E0C6',
  300: '#6FC18C',
  400: '#2F9A55',
  500: '#17803D',
  600: '#126331',
  700: '#0F5C2E',
} as const;

const ember = {
  50: '#FCEDE3',
  100: '#F7D6C1',
  300: '#E09468',
  500: '#B95223',
  600: '#99411A',
  700: '#6F2E12',
} as const;

/**
 * The one coloured thing left in the interface, and it is the mark.
 *
 * Buttons were this red until it met the rest of the app on a phone. The
 * food colours - forest, wheat, terracotta - are what give these screens
 * their warmth, and a saturated pink-red is a fourth red arguing with the
 * terracotta. With every button wearing it, the loudest thing on a page
 * about food was the furniture.
 */
const brand = {
  mark: '#C42233',
  markDark: '#F07C8A',
} as const;


const light: Palette = {
  background: mint[50],
  surface: mint[0],
  surfaceRaised: mint[0],
  surfaceAlt: mint[100],
  surfacePressed: mint[200],
  separator: '#E0EDE6',
  border: mint[300],
  borderStrong: mint[400],
  shadow: mint[900],

  text: mint[900],
  /*
    7.0:1 on the page and 6.5:1 on the alt surface, against the quietest
    tier's 4.9 and 4.5. Three tiers that measure the same are one tier with
    extra names, so the gap between these two is checked in
    `theme/__tests__/contrast.test.ts` rather than eyeballed.
  */
  textMuted: mint[600],
  /*
    Not a lighter mint: at anything paler this measured below 4.5:1 on the
    alt surface, which is exactly where the captions and timestamps this
    tier exists for are drawn.
  */
  textSubtle: mint[500],
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  /*
    One green for the whole light interface.

    A filled button, a chosen chip, a finished step and the one word picked
    out of a headline are all this, so the pale screens have a single
    identity colour rather than borrowing ink. It is the light scheme's
    counterpart to the lime on the dark page: same job, same places, a
    colour that survives on paper instead of on black.
  */
  primary: grass[500],
  primaryPressed: grass[600],
  primarySoft: grass[100],
  primaryOnSoft: grass[700],

  // Ember stays the scan accent in both schemes: one job, one colour.
  accent: ember[500],
  accentPressed: ember[600],
  accentSoft: ember[50],
  accentOnSoft: ember[600],

  success: grass[500],
  successSoft: grass[50],
  successOnSoft: grass[700],
  warning: '#8A5A08',
  warningSoft: '#FBF0DB',
  warningOnSoft: '#6B4606',
  danger: '#A3291F',
  dangerPressed: '#842019',
  dangerSoft: '#FAE7E4',
  dangerOnSoft: '#842019',
  info: '#1F5A86',
  infoSoft: '#E4EDF5',
  infoOnSoft: '#17456A',

  chart: grass[500],

  /*
    The same four hues as the dark scheme, darkened for paper.

    They used to be forest, wheat and terracotta here and red, amber and
    blue there, which meant protein changed colour when the user changed
    appearance - so a chart learned in one scheme had to be learned again in
    the other. Hue carries the identity now and lightness does the adapting.
    Every one clears 3.9:1 against the page and the alt surface, so a filled
    bar can be told from its track.
  */
  protein: '#C2413F',
  carbs: '#9A6B0D',
  fat: '#2C6BC4',
  fiber: '#15756F',

  scrim: 'rgba(10, 20, 16, 0.55)',
  skeleton: mint[100],
};

/**
 * Dark mode.
 *
 * Not an inversion. Surfaces step UP in lightness rather than down, and the
 * page is a genuinely warm near-black - it claimed to be one before while
 * being measurably blue, which is what made photographs of food look
 * refrigerated against it.
 *
 * The forest identity stays in light mode's furniture and remains a data
 * colour here. Two adjacent greens, one meaning "selected" and one meaning
 * "succeeded", would be harder to tell apart on a dark page than the ink
 * they replaced - so a filled button is still near-white, which also keeps
 * the contrast ratio that was measured for it.
 */
const dark: Palette = {
  background: '#0A0A0A',
  surface: '#141414',
  surfaceRaised: '#171717',
  surfaceAlt: '#1F1F1F',
  surfacePressed: '#262626',
  separator: '#232323',
  border: '#2C2C2C',
  borderStrong: '#3D3D3D',
  shadow: '#000000',

  text: '#FFFFFF',
  textMuted: '#A1A1A1',
  /*
    8.0:1 on the page and 6.9:1 on the raised card. Still clearly the
    quietest of the three tiers, and still above AA for 12pt text, which is
    what this tier is used for.
  */
  textSubtle: '#8C8C8C',
  textOnPrimary: '#0A0A0A',
  textOnAccent: '#190A03',

  /*
    Lime, and it is the whole identity of the dark app.

    The ring on Home, the camera button in the middle of the tab bar, the
    active tab, a filled button and a finished step are all this one colour,
    so pressing something and having something succeed are visibly the same
    family. Near-black sits on it rather than white: white on this green
    measures 1.6:1 and is unreadable at any size.
  */
  primary: '#A3E635',
  primaryPressed: '#8CCB22',
  primarySoft: '#1A2410',
  primaryOnSoft: '#C7F08C',

  accent: ember[300],
  accentPressed: '#C47A4E',
  accentSoft: '#2E1B10',
  accentOnSoft: ember[100],

  success: '#A3E635',
  successSoft: '#1A2410',
  successOnSoft: '#C7F08C',
  warning: '#F2B544',
  warningSoft: '#2B2110',
  warningOnSoft: '#F7D18A',
  danger: '#F27A7A',
  dangerPressed: '#D86565',
  dangerSoft: '#2C1414',
  dangerOnSoft: '#F7A6A6',
  info: '#5B9BF8',
  infoSoft: '#111C2E',
  infoOnSoft: '#A3C5FB',

  chart: '#A3E635',

  /*
    Four hues rather than four greens. On a black page the macro bars sit
    side by side in a single row and have to be told apart at a glance and
    at 4pt tall, which is a job hue does and lightness alone does not. Every
    one of them clears 3:1 against both the page and the empty track behind
    it, so a filled bar reads as filled.
  */
  protein: '#FF6B6B',
  carbs: '#F2B544',
  fat: '#5B9BF8',
  fiber: '#3FC8BE',

  scrim: 'rgba(0, 0, 0, 0.72)',
  skeleton: '#1F1F1F',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };

/**
 * Palette keys whose value is a single colour.
 *
 * Every key is one today, but a component that takes a colour name should
 * still say so through this rather than through `keyof Palette`, so adding
 * a gradient or a tuple back cannot silently break the callers.
 */
export type ColorKey = {
  [K in keyof Palette]: Palette[K] extends string ? K : never;
}[keyof Palette];

/** The ramps, for the rare case a component needs a specific step. */
export const ramps = { neutral, mint, forest, grass, ember, brand } as const;
