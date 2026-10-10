/**
 * Design tokens for FoodLens AI.
 *
 * These are raw, mode-independent values. Colors live in `palette.ts` because
 * they change between light and dark mode; everything here is constant.
 */

/** 4pt spacing scale. Use these instead of magic numbers in styles. */
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

/** Corner radii. `pill` is intentionally large so it rounds any height. */
export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof radius;

/**
 * Type scale. We deliberately use the platform system font: it ships with the
 * OS, needs no download, and already respects the user's font settings.
 */
export const typography = {
  display: { fontSize: 32, lineHeight: 38, letterSpacing: -0.6, fontWeight: '700' },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: -0.4, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2, fontWeight: '600' },
  subheading: { fontSize: 17, lineHeight: 23, letterSpacing: -0.1, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, letterSpacing: 0, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, letterSpacing: 0, fontWeight: '600' },
  bodySm: { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontWeight: '400' },
  bodySmStrong: { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.1, fontWeight: '500' },
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 0.8, fontWeight: '700' },
  /** Tabular-ish numbers for nutrition readouts. */
  metric: { fontSize: 22, lineHeight: 26, letterSpacing: -0.4, fontWeight: '700' },
  metricSm: { fontSize: 15, lineHeight: 18, letterSpacing: -0.2, fontWeight: '700' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Minimum hit target. Below this, controls are hard to tap reliably. */
export const minTouchTarget = 44;

/** Animation durations in ms. Keep motion short and purposeful. */
export const duration = {
  instant: 90,
  fast: 160,
  normal: 240,
  slow: 360,
} as const;
