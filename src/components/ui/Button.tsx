import { cloneElement, isValidElement, useState } from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type TypographyVariant } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

/**
 * Two levels, and only two.
 *
 * Every filled button is identical: a pill filled with ink - near-black on
 * a light page, near-white on a dark one. `ghost` is the other level, the
 * same ink as text with no fill.
 *
 * Buttons used to be a red gradient, taken from a reference image, and in
 * isolation it looked right. On a real screen it was a fourth red arguing
 * with the terracotta in the charts, and since every button wore it the
 * loudest thing on a page about food was the furniture. Ink cannot clash
 * with anything, which leaves the food as the only colour on the screen -
 * and that is the app's colour, not the buttons'.
 *
 * Two filled pills stacked in a footer still looks wrong. They compete,
 * and the smaller one reads as a second call to action rather than as the
 * quiet way out that it is.
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
  /** A tertiary action: the same red, as text, with no fill. */
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
 * A filled one is a pill of ink: near-black on a light page, near-white on
 * a dark one, with the label reversed out of it. Every filled button in the
 * app is identical, so nothing varies at random.
 *
 * Emphasis is carried by size, by width and by order rather than by colour -
 * the primary action is the large full-width one, with alternatives smaller
 * beneath it, and `ghost` for the quietest of them.
 *
 * Worth naming because it is a real cost: a destructive button looks like a
 * confirming one. Every destructive action in the app sits behind its own
 * confirmation dialog, and that is what guards it; the button does not warn
 * on sight.
 */
export function Button({
  label,
  onPress,
  // Every variant but `ghost` renders identically. The names are kept
  // because they still say what an action is for at the call site.
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

  const isGhost = variant === 'ghost';

  // A filled button commits something, so it gets the tap feedback. A text
  // one is usually the way out of a screen.
  const wantsHaptic = haptic ?? !isGhost;
  const foreground = isGhost ? theme.colors.primary : theme.colors.textOnPrimary;

  const shape: ViewStyle = {
    // Keeps the touch target even with no fill to show for it.
    height: spec.height,
    // Tight, so text does not sit in a wide invisible slab that swallows
    // taps meant for whatever is beside it.
    paddingHorizontal: isGhost ? spec.gap : spec.paddingHorizontal,
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
      <View
        style={[
          shape,
          isGhost
            ? { opacity: pressed ? 0.6 : 1 }
            : {
                backgroundColor: pressed
                  ? theme.colors.primaryPressed
                  : theme.colors.primary,
              },
        ]}
      >
        {content}
      </View>
    </PressableScale>
  );
}

/** The icon size that pairs with each button size. */
export function buttonIconSize(size: ButtonSize = 'md'): number {
  return SIZES[size].iconSize;
}
