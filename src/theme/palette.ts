/**
 * Color for FoodLens AI.
 *
 * Built from two ramps rather than picked ad hoc:
 *
 *   **Clay** - a warm neutral. Paper, not grey. Food photography sits badly
 *   on cold grey, and a warm page makes the greens look like food rather than
 *   like a finance app.
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

  /** Primary call-to-action gradient, from top-left to bottom-right. */
  ctaGradient: readonly [string, string];
  ctaGradientPressed: readonly [string, string];
  /** Flat equivalent, where a gradient is not possible. */
  ctaFlat: string;
  textOnCta: string;

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

  /** Macro nutrient identity colours, used consistently app-wide. */
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

/** Warm neutral. 0 is paper, 900 is ink. */
const clay = {
  0: '#FFFFFF',
  25: '#FAF8F4',
  50: '#F4F1EA',
  100: '#EBE7DE',
  200: '#DCD7CA',
  300: '#C3BCAB',
  400: '#9B9382',
  500: '#736C5D',
  600: '#55503F',
  700: '#3A362A',
  800: '#26231B',
  900: '#15130E',
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
 * The call-to-action red.
 *
 * A two-stop gradient rather than a flat fill, matching the reference the
 * client supplied: a rose-leaning red at the top left easing into a deeper
 * crimson at the bottom right. Used only for the primary action, which is
 * what keeps it from becoming decoration.
 */
const crimson = {
  gradientFrom: '#EF4B5E',
  gradientTo: '#DC2B3C',
  pressedFrom: '#DA3F51',
  pressedTo: '#C42233',
  /** Flat equivalent, for places a gradient cannot go. */
  flat: '#E43B4D',
  soft: '#FDEAEC',
  softDark: '#2E1418',
  onSoft: '#B3222F',
} as const;

const light: Palette = {
  background: clay[25],
  surface: clay[0],
  surfaceRaised: clay[0],
  surfaceAlt: clay[50],
  surfacePressed: clay[100],
  separator: clay[100],
  border: clay[200],
  borderStrong: clay[300],
  shadow: clay[900],

  text: clay[900],
  textMuted: clay[500],
  textSubtle: clay[400],
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  primary: forest[500],
  primaryPressed: forest[600],
  primarySoft: forest[50],
  primaryOnSoft: forest[600],

  accent: ember[500],
  accentPressed: ember[600],
  accentSoft: ember[50],
  accentOnSoft: ember[600],

  ctaGradient: [crimson.gradientFrom, crimson.gradientTo],
  ctaGradientPressed: [crimson.pressedFrom, crimson.pressedTo],
  ctaFlat: crimson.flat,
  textOnCta: '#FFFFFF',

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

  protein: '#3A6FA0',
  carbs: '#A5761C',
  fat: '#8A59A6',

  scrim: 'rgba(21, 19, 14, 0.5)',
  skeleton: clay[100],
};

/**
 * Dark mode.
 *
 * Not an inversion. The page is a warm near-black, surfaces step UP in
 * lightness rather than down, and the brand green is lifted well past its
 * light-mode value so it stays legible without glowing.
 */
const dark: Palette = {
  background: '#121109',
  surface: '#1C1A12',
  surfaceRaised: '#242117',
  surfaceAlt: '#262319',
  surfacePressed: '#322E21',
  separator: '#2B2819',
  border: '#36321F',
  borderStrong: '#4E4934',
  shadow: '#000000',

  text: '#F3F0E7',
  textMuted: '#A49D88',
  textSubtle: '#7D765F',
  textOnPrimary: '#06150E',
  textOnAccent: '#190A03',

  primary: forest[300],
  primaryPressed: forest[400],
  primarySoft: '#16281F',
  primaryOnSoft: forest[200],

  accent: ember[300],
  accentPressed: '#C47A4E',
  accentSoft: '#2E1B10',
  accentOnSoft: ember[100],

  // The CTA keeps its colour in dark mode: it is the one element that should
  // read identically in both, and the red already has the contrast for it.
  ctaGradient: [crimson.gradientFrom, crimson.gradientTo],
  ctaGradientPressed: [crimson.pressedFrom, crimson.pressedTo],
  ctaFlat: crimson.flat,
  textOnCta: '#FFFFFF',

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

  protein: '#7FAADA',
  carbs: '#D8AD5E',
  fat: '#BC8FD2',

  scrim: 'rgba(0, 0, 0, 0.64)',
  skeleton: '#242117',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };

/**
 * Palette keys whose value is a single colour.
 *
 * `ctaGradient` and `ctaGradientPressed` hold a pair of stops, so a component
 * that sets one colour should accept this rather than every key.
 */
export type ColorKey = {
  [K in keyof Palette]: Palette[K] extends string ? K : never;
}[keyof Palette];

/** The ramps, for the rare case a component needs a specific step. */
export const ramps = { clay, forest, ember, crimson } as const;
