import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Design tokens for FoodLens AI.
 *
 * Mode-independent values only; colors live in `palette.ts`.
 *
 * Three decisions shape this file:
 *
 *  1. **Numbers get their own type styles, with tabular figures.** This app
 *     shows a lot of changing numbers. Proportional digits make a calorie
 *     total jitter sideways as it updates, which reads as cheap. Every
 *     `metric*` style below locks digit width.
 *  2. **Depth, not outlines.** Earlier revisions drew a hairline box around
 *     every piece of content, which is what you do when you do not trust the
 *     spacing. Grouping is done with whitespace and alignment, and the few
 *     surfaces that need to lift off the page use `elevation` instead.
 *  3. **Fewer radii, used consistently.** Controls, surfaces and media each
 *     get one value rather than a spectrum.
 */

// ---------------------------------------------------------------------------
// Space
// ---------------------------------------------------------------------------

/** 4pt scale. Use these instead of magic numbers. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

export type SpacingKey = keyof typeof spacing;

/**
 * Horizontal screen inset.
 *
 * 20 rather than 16: it gives text a little more room to breathe against the
 * bezel and leaves 16 free as the inner gap, so the two never collide.
 */
export const gutter = 20;

/** Vertical rhythm between major blocks on a screen. */
export const blockGap = 28;

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

/**
 * Corner radii, deliberately few.
 *
 *   control  inputs, buttons, chips
 *   surface  grouped lists and raised panels
 *   media    images and thumbnails
 *   pill     anything fully rounded
 */
export const radius = {
  none: 0,
  xs: 6,
  control: 12,
  surface: 18,
  media: 14,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof radius;

/** Hairline that reads as a separator rather than a box. */
export const hairline = Platform.OS === 'ios' ? 0.5 : 1;

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

/**
 * The platform UI font: San Francisco on iOS, Roboto on Android.
 *
 * Deliberate. It is the typeface users already read everything else in, it
 * ships with the OS so there is no font-loading flash, and it honours the
 * user's own text-size setting. Identity comes from how it is set - the
 * weight ladder, the tracking on large sizes, and the tabular figures below -
 * not from a novelty face.
 */
const FAMILY = Platform.select({ ios: undefined, default: undefined });

/** Locks digit width so changing numbers do not shift the layout. */
const TABULAR: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

/**
 * The type scale.
 *
 * Large sizes get negative tracking because SF and Roboto are both set loose
 * for small text; without it a 34pt headline looks spindly.
 */
export const typography = {
  /** Screen titles. One per screen, at the top. */
  display: {
    fontFamily: FAMILY,
    fontSize: 33,
    lineHeight: 39,
    letterSpacing: -0.8,
    fontWeight: '700',
  },
  /** A hero inside a screen, e.g. a recipe name. */
  title1: {
    fontFamily: FAMILY,
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.5,
    fontWeight: '700',
  },
  /** Section headings. */
  title2: {
    fontFamily: FAMILY,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.3,
    fontWeight: '600',
  },
  /** List row titles and emphasis inside body copy. */
  headline: {
    fontFamily: FAMILY,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
    fontWeight: '600',
  },
  body: {
    fontFamily: FAMILY,
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: -0.1,
    fontWeight: '400',
  },
  /** Secondary body: supporting lines under a title. */
  callout: {
    fontFamily: FAMILY,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    fontWeight: '400',
  },
  /** Help text and metadata. */
  footnote: {
    fontFamily: FAMILY,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
    fontWeight: '400',
  },
  /** Timestamps and the smallest metadata. */
  caption: {
    fontFamily: FAMILY,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0,
    fontWeight: '500',
  },
  /**
   * Form labels and section eyebrows.
   *
   * Sentence case, not uppercase. Rows of SHOUTING MICRO LABELS were one of
   * the things that made earlier revisions read as generated.
   */
  label: {
    fontFamily: FAMILY,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0,
    fontWeight: '600',
  },

  /** The one big number on a screen, e.g. the day's energy. */
  metricXL: {
    fontFamily: FAMILY,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1.4,
    fontWeight: '700',
    ...TABULAR,
  },
  metricL: {
    fontFamily: FAMILY,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.7,
    fontWeight: '700',
    ...TABULAR,
  },
  metricM: {
    fontFamily: FAMILY,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.3,
    fontWeight: '600',
    ...TABULAR,
  },
  metricS: {
    fontFamily: FAMILY,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.1,
    fontWeight: '600',
    ...TABULAR,
  },
} as const;

export type TypographyVariant = keyof typeof typography;

// ---------------------------------------------------------------------------
// Depth
// ---------------------------------------------------------------------------

export type ElevationLevel = 0 | 1 | 2 | 3;

/**
 * Shadows, which are the main way surfaces separate from the page.
 *
 * iOS and Android are specified separately because `elevation` alone looks
 * wrong on iOS and iOS shadow props are ignored on Android. The shadow color
 * is a warm near-black rather than pure black, so it sits in the same family
 * as the rest of the palette.
 */
export function elevation(level: ElevationLevel, shadowColor: string): ViewStyle {
  if (level === 0) return {};

  if (Platform.OS === 'android') {
    return { elevation: level === 1 ? 2 : level === 2 ? 6 : 12 };
  }

  const specs: Record<1 | 2 | 3, ViewStyle> = {
    1: {
      shadowColor,
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
    },
    2: {
      shadowColor,
      shadowOpacity: 0.1,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    3: {
      shadowColor,
      shadowOpacity: 0.16,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 14 },
    },
  };
  return specs[level];
}

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

/** Minimum hit target. Below this, controls are hard to tap reliably. */
export const minTouchTarget = 44;

/**
 * Motion durations.
 *
 * Short. Anything over ~250ms on a press starts to feel like the app is
 * thinking rather than responding.
 */
export const duration = {
  press: 90,
  fast: 160,
  normal: 220,
  slow: 320,
} as const;

/** How far a pressable scales down on touch. Enough to feel, not to wobble. */
export const pressScale = 0.975;

/**
 * Spring configurations.
 *
 * A duration-and-easing curve arrives at its destination and stops dead.
 * A spring decelerates into it, which is what the hand expects of something
 * it just pushed - and the difference between an interface that responds and
 * one that merely updates.
 *
 * Both are critically damped or near it: no visible bounce. Bounce on a
 * press reads as a toy, and on a number it makes the value hard to read
 * while it settles.
 *
 *   press    a control under the finger; must feel instant
 *   settle   something arriving on screen, or a value changing
 */
export const spring = {
  press: { damping: 26, stiffness: 420, mass: 0.7 },
  settle: { damping: 22, stiffness: 180, mass: 0.9 },
} as const;

export type SpringKey = keyof typeof spring;
