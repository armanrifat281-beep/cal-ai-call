import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme, type ElevationLevel, type SpacingKey } from '@/theme';

export type SurfaceVariant =
  /** Background fill only. No outline. The default. */
  | 'plain'
  /** Lifts off the page with a shadow. For the one thing that matters most. */
  | 'raised'
  /** A quieter inset fill, for secondary content inside a surface. */
  | 'sunken'
  /**
   * A grouped list, iOS-style: one rounded container, rows separated by
   * hairlines rather than each row being its own box.
   */
  | 'grouped';

export interface SurfaceProps extends ViewProps {
  variant?: SurfaceVariant;
  padding?: SpacingKey;
  /** Overrides the variant's default depth. */
  level?: ElevationLevel;
  style?: StyleProp<ViewStyle>;
}

/**
 * A content surface.
 *
 * Replaces the old `Card`, which drew a hairline box around everything. That
 * is what you reach for when you do not trust your spacing, and a screen of
 * them reads as generated. Here the default is `plain`: a fill, no outline,
 * grouped by whitespace. Only `raised` draws a shadow, and only `grouped`
 * draws separators - between rows, never around the block.
 */
export function Surface({
  variant = 'plain',
  padding = 'none',
  level,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const theme = useTheme();

  const backgroundColor =
    variant === 'sunken'
      ? theme.colors.surfaceAlt
      : variant === 'raised'
        ? theme.colors.surfaceRaised
        : theme.colors.surface;

  const depth = level ?? (variant === 'raised' ? 1 : 0);

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor,
          borderRadius: theme.radius.surface,
          padding: theme.spacing[padding],
          overflow: variant === 'grouped' ? 'hidden' : 'visible',
        },
        theme.elevation(depth),
        style,
      ]}
    >
      {children}
    </View>
  );
}
