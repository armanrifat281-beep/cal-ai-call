import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type TypographyVariant } from '@/theme';
import type { Palette } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  /** Semantic palette key, or any raw color string. */
  color?: keyof Palette | (string & {});
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
}

/**
 * The only text component the app should use. Centralizing it keeps the type
 * scale consistent and gives us one place to handle color and alignment.
 */
export function Text({
  variant = 'body',
  color = 'text',
  align,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  // The palette holds one tuple value (the CTA gradient), so a lookup is only
  // accepted when it actually yields a colour string.
  const candidate = theme.colors[color as keyof Palette];
  const resolvedColor = typeof candidate === 'string' ? candidate : (color as string);

  return (
    <RNText
      {...rest}
      style={[
        theme.typography[variant] as TextStyle,
        { color: resolvedColor },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
