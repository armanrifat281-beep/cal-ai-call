import { LinearGradient } from 'expo-linear-gradient';
import { cloneElement, isValidElement, useState } from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type TypographyVariant } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

/**
 * Every variant now renders the same call-to-action pill.
 *
 * The names are kept because the call sites use them and because they still
 * say what an action is for, which matters to anyone reading the code. They
 * no longer change how the button looks.
 */
export type ButtonVariant =
  /** The main commitment on a screen. */
  | 'primary'
  /** A hero action that is not the screen's main commitment. */
  | 'accent'
  /** A secondary commitment. */
  | 'tonal'
  /** A neutral alternative: cancel, dismiss, choose another. */
  | 'secondary'
  /** A tertiary action. */
  | 'ghost'
  /** Destructive. */
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
 * Deliberately tall and generously padded. In the supplied reference the
 * button is roughly three and a half times the height of its own text, which
 * is what makes it read as a soft, confident shape rather than a tag; these
 * follow that ratio. The padding is wide for the same reason.
 *
 * The smallest size is 44 points, so even an inline button clears the
 * minimum touch target on its own.
 */
const SIZES: Record<ButtonSize, SizeSpec> = {
  sm: { height: 44, paddingHorizontal: 20, text: 'label', gap: 7, iconSize: 16 },
  md: { height: 54, paddingHorizontal: 26, text: 'headline', gap: 9, iconSize: 19 },
  lg: { height: 62, paddingHorizontal: 34, text: 'title2', gap: 11, iconSize: 22 },
};

/**
 * A button.
 *
 * One look, used by every button in the app: a fully rounded pill with a
 * rose-to-crimson gradient running top-left to bottom-right, and bold white
 * text, matching the supplied reference.
 *
 * This is a deliberate change from scarcity to consistency. An earlier
 * version gave the gradient only to the two hero variants and left the rest
 * flat, on the usual argument that a call to action means nothing if
 * everything looks like one. The brief here is the opposite and explicit:
 * every button is to look like the reference, with none left out. So
 * emphasis is no longer carried by colour. It is carried by size, by order,
 * and by which button is full width - the primary action on a screen is the
 * large, full-width one, and the alternatives sit below it, smaller.
 *
 * The cost is worth naming where it lands hardest: a destructive button is
 * now the same colour as a confirming one. Every destructive action in the
 * app is behind a separate confirmation dialog, which is what actually
 * guards it, but the button itself no longer warns on sight.
 */
export function Button({
  label,
  onPress,
  // `variant` is accepted and ignored: it still documents what an action is
  // for at the call site, but it no longer changes how the button looks.
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

  // Every button is filled now, so every button gets the tap feedback.
  const wantsHaptic = haptic ?? true;
  const foreground = theme.colors.textOnCta;

  const shape: ViewStyle = {
    height: spec.height,
    paddingHorizontal: spec.paddingHorizontal,
    // Fully rounded: the radius is half the height, so the ends are true
    // semicircles at every size.
    borderRadius: spec.height / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spec.gap,
  };

  /**
   * Forces a slot's icon onto the button's own foreground.
   *
   * Call sites used to pick a colour to suit whichever fill their variant
   * had. Now that every button is the same gradient, any of those would be
   * dark ink on red. Rather than correcting dozens of call sites and
   * trusting the next one to remember, the button paints its own contents.
   */
  const tint = (node: React.ReactNode): React.ReactNode =>
    isValidElement<{ color?: string }>(node)
      ? cloneElement(node, { color: foreground })
      : node;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        tint(leading)
      )}
      {/*
        `flexShrink` so a long label in a narrow button ellipsizes instead
        of pushing past the pill. Two of these sit side by side in a row in
        several places, and the padding is generous.
      */}
      <Text
        variant={spec.text}
        color={foreground}
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {label}
      </Text>
      {trailing ? <View>{tint(trailing)}</View> : null}
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
    </PressableScale>
  );
}

/** The icon size that pairs with each button size. */
export function buttonIconSize(size: ButtonSize = 'md'): number {
  return SIZES[size].iconSize;
}
