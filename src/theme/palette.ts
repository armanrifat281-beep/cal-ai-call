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
  background: neutral[25],
  surface: neutral[0],
  surfaceRaised: neutral[0],
  surfaceAlt: neutral[50],
  surfacePressed: neutral[100],
  separator: neutral[100],
  border: neutral[200],
  borderStrong: neutral[300],
  shadow: neutral[900],

  text: neutral[900],
  textMuted: neutral[500],
  textSubtle: neutral[400],
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  // One accent for the whole interface: the same red as the buttons.
  // Anything selected, active or in progress wears it, so a chosen chip and
  // the button you press next are visibly the same idea. Forest is still the
  // app's green, but as a data colour now - protein on a chart - rather than
  // as the thing that marks a choice.
  /*
    Deep forest. A filled button, a chosen chip and a finished step are all
    this, so the app has one identity colour rather than borrowing ink.

    Chosen over the near-black that was here before, which was safe but said
    nothing: a page of grey furniture and black buttons is not a food
    product, it is a settings screen. The risk the ink was avoiding is real
    and worth naming - a green chip can read as a chart swatch - so the
    charts use forest 500 and 600 for data while the furniture uses 700,
    dark enough to read as a surface rather than as a value.
  */
  primary: forest[700],
  primaryPressed: forest[800],
  primarySoft: forest[50],
  primaryOnSoft: forest[700],

  accent: ember[500],
  accentPressed: ember[600],
  accentSoft: ember[50],
  accentOnSoft: ember[600],

  success: forest[500],
  successSoft: forest[50],
  successOnSoft: forest[600],
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

  chart: forest[500],

  protein: '#1A543E',
  carbs: '#B5861F',
  fat: '#A8502C',

  scrim: 'rgba(10, 10, 13, 0.55)',
  skeleton: neutral[100],
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
  background: '#121110',
  surface: '#1C1A19',
  surfaceRaised: '#231F1E',
  surfaceAlt: '#282423',
  surfacePressed: '#322D2C',
  separator: '#2B2726',
  border: '#36312F',
  borderStrong: '#514A47',
  shadow: '#000000',

  text: '#F4F2F0',
  textMuted: '#A5A09A',
  textSubtle: '#7A756F',
  textOnPrimary: neutral[900],
  textOnAccent: '#190A03',

  primary: neutral[25],
  primaryPressed: neutral[200],
  primarySoft: neutral[800],
  primaryOnSoft: neutral[25],

  accent: ember[300],
  accentPressed: '#C47A4E',
  accentSoft: '#2E1B10',
  accentOnSoft: ember[100],

  // The CTA keeps its colour in dark mode: it is the one element that should
  // read identically in both, and the red already has the contrast for it.
  success: forest[300],
  successSoft: '#16281F',
  successOnSoft: forest[200],
  warning: '#D9A94F',
  warningSoft: '#2E2412',
  warningOnSoft: '#EBC684',
  danger: '#E8857C',
  dangerPressed: '#CC6E66',
  dangerSoft: '#301713',
  dangerOnSoft: '#F2ACA5',
  info: '#79ACD6',
  infoSoft: '#15232E',
  infoOnSoft: '#A6C9E4',

  chart: forest[300],

  protein: '#378463',
  carbs: '#EFD293',
  fat: '#DA8A62',

  scrim: 'rgba(0, 0, 0, 0.64)',
  skeleton: '#232329',
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
export const ramps = { neutral, forest, ember, brand } as const;
