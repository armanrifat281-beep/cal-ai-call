import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme, type RadiusKey, type SpacingKey } from '@/theme';

export interface CardProps extends ViewProps {
  padding?: SpacingKey;
  radiusKey?: RadiusKey;
  /** `plain` has no border; `outlined` adds a hairline; `soft` uses the alt fill. */
  variant?: 'plain' | 'outlined' | 'soft';
  style?: StyleProp<ViewStyle>;
}

export function Card({
  padding = 'base',
  radiusKey = 'lg',
  variant = 'outlined',
  style,
  children,
  ...rest
}: CardProps) {
  const theme = useTheme();

  const backgroundColor =
    variant === 'soft' ? theme.colors.surfaceAlt : theme.colors.surface;

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor,
          borderRadius: theme.radius[radiusKey],
          padding: theme.spacing[padding],
          borderWidth: variant === 'outlined' ? 1 : 0,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
