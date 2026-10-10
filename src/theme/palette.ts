/**
 * Semantic color palette for FoodLens AI.
 *
 * Original palette: warm off-white paper, herb green as the brand color, and a
 * terracotta accent. Chosen to feel calm and food-adjacent without looking like
 * any existing nutrition app.
 *
 * Every pairing used for text-on-background in the app was checked to clear
 * WCAG AA (4.5:1) for body text, or AA Large (3:1) for >=20pt bold text.
 */

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  /** Page background. */
  background: string;
  /** Raised card / sheet surface. */
  surface: string;
  /** Secondary fill inside a surface (chips, inputs, progress tracks). */
  surfaceAlt: string;
  /** Pressed/hover state fill. */
  surfacePressed: string;
  /** Hairline dividers and input outlines. */
  border: string;
  /** Stronger outline for focus rings. */
  borderStrong: string;

  /** Primary body text. */
  text: string;
  /** De-emphasized text: labels, help text, timestamps. */
  textMuted: string;
  /** Text on top of `primary`. */
  textOnPrimary: string;
  /** Text on top of `accent`. */
  textOnAccent: string;

  /** Brand green: primary actions. */
  primary: string;
  /** Darker brand green for pressed state. */
  primaryPressed: string;
  /** Low-opacity brand tint for badges and selected rows. */
  primarySoft: string;
  /** Text/icon color readable on `primarySoft`. */
  primaryOnSoft: string;

  /** Terracotta accent: the scan action and highlights. */
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

  /** Macro nutrient identity colors, used consistently app-wide. */
  protein: string;
  carbs: string;
  fat: string;

  /** Scrim behind modals. */
  scrim: string;
  /** Skeleton loader base. */
  skeleton: string;
}

const light: Palette = {
  background: '#FBFAF6',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F0E9',
  surfacePressed: '#E8E5DC',
  border: '#E4E0D6',
  borderStrong: '#C8C3B5',

  text: '#1B1A17',
  textMuted: '#67635B',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  primary: '#24664B',
  primaryPressed: '#1B503A',
  primarySoft: '#E2EFE8',
  primaryOnSoft: '#1B503A',

  accent: '#B2541F',
  accentPressed: '#8E4218',
  accentSoft: '#FAE8DC',
  accentOnSoft: '#8E4218',

  success: '#1F7A4D',
  successSoft: '#E1F2E8',
  successOnSoft: '#15603A',
  warning: '#8A5A08',
  warningSoft: '#FBEFD6',
  warningOnSoft: '#6E4706',
  danger: '#A52A2A',
  dangerPressed: '#842121',
  dangerSoft: '#F9E3E3',
  dangerOnSoft: '#842121',
  info: '#215C8F',
  infoSoft: '#E2ECF6',
  infoOnSoft: '#1A4870',

  protein: '#3C6E9F',
  carbs: '#A9761F',
  fat: '#8C5AA8',

  scrim: 'rgba(20, 19, 16, 0.45)',
  skeleton: '#EBE8E0',
};

const dark: Palette = {
  background: '#121410',
  surface: '#1B1E19',
  surfaceAlt: '#252923',
  surfacePressed: '#30352E',
  border: '#343930',
  borderStrong: '#4C5248',

  text: '#F2F1EC',
  textMuted: '#A3A79C',
  textOnPrimary: '#0D1A13',
  textOnAccent: '#1F1008',

  primary: '#79C9A1',
  primaryPressed: '#5FAF87',
  primarySoft: '#1D3428',
  primaryOnSoft: '#A3DCBE',

  accent: '#E79C6B',
  accentPressed: '#CE8551',
  accentSoft: '#3A271B',
  accentOnSoft: '#F0BC95',

  success: '#6FC996',
  successSoft: '#1A3326',
  successOnSoft: '#9BDCB7',
  warning: '#E0B259',
  warningSoft: '#352B17',
  warningOnSoft: '#EFCE8E',
  danger: '#EC8A8A',
  dangerPressed: '#D06F6F',
  dangerSoft: '#3A1F1F',
  dangerOnSoft: '#F3AFAF',
  info: '#7FB3E0',
  infoSoft: '#1B2B3A',
  infoOnSoft: '#A8CCEC',

  protein: '#7FAEDC',
  carbs: '#DFB264',
  fat: '#C093D8',

  scrim: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#262A24',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };
