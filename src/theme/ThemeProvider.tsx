import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';

import { palettes, type ColorScheme, type Palette } from './palette';
import {
  blockGap,
  duration,
  elevation,
  gutter,
  hairline,
  minTouchTarget,
  pressScale,
  radius,
  spacing,
  typography,
  type ElevationLevel,
} from './tokens';

/** What the user picked in Settings. `system` follows the OS. */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  /** The scheme actually being rendered, after resolving `system`. */
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  duration: typeof duration;
  minTouchTarget: number;
  /** Horizontal screen inset. */
  gutter: number;
  /** Vertical rhythm between major blocks. */
  blockGap: number;
  /** Platform hairline width. */
  hairline: number;
  /** How far a pressable scales on touch. */
  pressScale: number;
  /**
   * Shadow for a level, already resolved against this scheme's shadow
   * colour. Call it rather than hand-rolling shadow props.
   */
  elevation: (level: ElevationLevel) => ReturnType<typeof elevation>;
}

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  /** False until the stored preference has been read from disk. */
  isReady: boolean;
}

const STORAGE_KEY = 'foodlens.theme-preference.v1';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildTheme(scheme: ColorScheme): Theme {
  const colors = palettes[scheme];
  return {
    scheme,
    colors,
    spacing,
    radius,
    typography,
    duration,
    minTouchTarget,
    gutter,
    blockGap,
    hairline,
    pressScale,
    elevation: (level) => elevation(level, colors.shadow),
  };
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && isThemePreference(stored)) {
          setPreferenceState(stored);
        }
      } catch {
        // A failed read is not fatal: we fall back to following the OS.
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Preference still applies for this session even if persisting fails.
    });
  }, []);

  const resolvedScheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: buildTheme(resolvedScheme),
      preference,
      setPreference,
      isReady,
    }),
    [resolvedScheme, preference, setPreference, isReady],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used inside <ThemeProvider>');
  }
  return ctx;
}

/** The common case: read colors and tokens inside a component. */
export function useTheme(): Theme {
  return useThemeContext().theme;
}

/**
 * Build StyleSheet-shaped styles that depend on the theme.
 *
 * Usage:
 *   const useStyles = makeStyles((t) => ({ box: { backgroundColor: t.colors.surface } }));
 *   const styles = useStyles();
 */
export function makeStyles<T extends Record<string, unknown>>(factory: (theme: Theme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => factory(theme), [theme]);
  };
}
