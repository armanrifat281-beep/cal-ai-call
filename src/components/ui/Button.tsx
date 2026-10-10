import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type TypographyVariant } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ButtonVariant =
  /** The one commitment on a screen. The red gradient pill. */
  | 'primary'
  /** A hero action that is not the screen's main commitment. Same treatment. */
  | 'accent'
  /** A secondary commitment. Brand-tinted fill. */
  | 'tonal'
  /** A neutral alternative: cancel, dismiss, choose another. */
  | 'secondary'
  /** A tertiary action. Text only. */
  | 'ghost'
  /** Destructive. Flat and darker, so it cannot be mistaken for the CTA. */
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Shows a spinner and blocks presses. Use for real in-flight work only. */
  loading?: boolean;
  fullWidth?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Light tap feedback. On by default for the filled variants. */
  haptic?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

interface SizeSpec {
  height: number;
  paddingHorizontal: number;
  text: TypographyVariant;
  gap: number;
  iconSize: number;
}

/**
 * Sizes.
 *
 * The horizontal padding is deliberately generous on `lg`: a pill with tight
 * padding reads as a tag rather than a button, and the reference is a wide,
 * confident shape.
 */
const SIZES: Record<ButtonSize, SizeSpec> = {
  sm: { height: 36, paddingHorizontal: 16, text: 'label', gap: 6, iconSize: 15 },
  md: { height: 48, paddingHorizontal: 22, text: 'headline', gap: 8, iconSize: 18 },
  lg: { height: 54, paddingHorizontal: 30, text: 'headline', gap: 10, iconSize: 20 },
};

/**
 * A button.
 *
 * `primary` and `accent` render the call-to-action style from the supplied
 * reference: a fully rounded pill with a rose-to-crimson gradient running
 * top-left to bottom-right, and bold white text.
 *
 * Everything is a pill, so the shapes agree across the app, but only the two
 * hero variants carry the gradient. If every button were the CTA there would
 * be no call to action - the point of the treatment is that it is scarce.
 * `danger` is flat and darker for the same reason: a destructive action must
 * not look like the thing you are being invited to press.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leading,
  trailing,
  haptic,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const spec = SIZES[size];
  const isBlocked = disabled || loading;

  const isCta = variant === 'primary' || variant === 'accent';
  const isFilled = isCta || variant === 'danger';
  const wantsHaptic = haptic ?? isFilled;

  const foreground = (() => {
    switch (variant) {
      case 'primary':
      case 'accent':
        return theme.colors.textOnCta;
      case 'danger':
        return '#FFFFFF';
      case 'tonal':
        return theme.colors.primaryOnSoft;
      case 'secondary':
        return theme.colors.text;
      case 'ghost':
      default:
        return theme.colors.primaryOnSoft;
    }
  })();

  const flatBackground = (() => {
    switch (variant) {
      case 'danger':
        return pressed ? theme.colors.dangerPressed : theme.colors.danger;
      case 'tonal':
        return theme.colors.primarySoft;
      case 'secondary':
        return theme.colors.surfaceAlt;
      case 'ghost':
      default:
        return 'transparent';
    }
  })();

  const shape: ViewStyle = {
    height: spec.height,
    paddingHorizontal:
      variant === 'ghost' ? spec.paddingHorizontal / 2 : spec.paddingHorizontal,
    // Fully rounded: the radius is half the height, so the ends are true
    // semicircles at every size.
    borderRadius: spec.height / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spec.gap,
  };

  const content = (
    <>
      {loading ? <ActivityIndicator size="small" color={foreground} /> : leading}
      <Text variant={spec.text} color={foreground} numberOfLines={1}>
        {label}
      </Text>
      {trailing ? <View>{trailing}</View> : null}
    </>
  );

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isBlocked}
      haptic={wantsHaptic && !isBlocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={[{ alignSelf: fullWidth ? 'stretch' : 'flex-start' }, style]}
    >
      {isCta ? (
        <LinearGradient
          colors={
            pressed
              ? [...theme.colors.ctaGradientPressed]
              : [...theme.colors.ctaGradient]
          }
          // Top-left to bottom-right, as in the reference.
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={shape}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[shape, { backgroundColor: flatBackground }]}>{content}</View>
      )}
    </PressableScale>
  );
}

/** The icon size that pairs with each button size. */
export function buttonIconSize(size: ButtonSize = 'md'): number {
  return SIZES[size].iconSize;
}
