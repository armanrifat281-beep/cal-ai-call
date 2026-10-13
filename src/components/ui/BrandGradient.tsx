import { LinearGradient } from 'expo-linear-gradient';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { ramps, useTheme } from '@/theme';

export interface BrandGradientProps {
  children?: React.ReactNode;
  /** Fills its parent when omitted. */
  style?: StyleProp<ViewStyle>;
  /** `full` is for a whole screen; `band` for the top of one. */
  extent?: 'full' | 'band';
}

/**
 * The app's gradient ground.
 *
 * Deep forest, not the brand red: red is this app's warning colour, and a
 * screen washed in it reads as an error state. The red appears only as a
 * faint bloom in one corner, and in the mark itself.
 *
 * It stays dark in light mode too. The type set over it is light, and a pale
 * gradient would need dark type - which would then compete with whatever
 * sits below it for prominence. Only the depth changes between schemes.
 */
export function BrandGradient({
  children,
  style,
  extent = 'full',
}: BrandGradientProps) {
  const theme = useTheme();
  const dark = theme.scheme === 'dark';

  const stops = dark
    ? ([ramps.forest[800], '#123A2B', theme.colors.background] as const)
    : ([ramps.forest[700], ramps.forest[600], ramps.forest[800]] as const);

  return (
    <View style={[{ overflow: 'hidden' }, style]} pointerEvents="box-none">
      <LinearGradient
        colors={stops}
        locations={extent === 'full' ? [0, 0.52, 1] : [0, 0.38, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Two blooms, placed to light the heading from behind rather than to
          decorate the corners. */}
      <View
        style={{
          position: 'absolute',
          top: extent === 'full' ? -120 : -90,
          right: extent === 'full' ? undefined : -70,
          left: extent === 'full' ? -80 : undefined,
          width: extent === 'full' ? 380 : 300,
          height: extent === 'full' ? 380 : 300,
          borderRadius: 190,
          backgroundColor: 'rgba(63,139,108,0.38)',
          opacity: dark ? 1 : 0.6,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: extent === 'full' ? 140 : -40,
          right: extent === 'full' ? -110 : undefined,
          left: extent === 'full' ? undefined : -60,
          width: extent === 'full' ? 300 : 220,
          height: extent === 'full' ? 300 : 220,
          borderRadius: 150,
          backgroundColor: 'rgba(196,34,51,0.14)',
        }}
      />

      {children}
    </View>
  );
}
