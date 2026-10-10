import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type TypographyVariant } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ButtonVariant =
  /** The one commitment on the screen. Filled brand. */
  | 'primary'
  /** The scan action, and nothing else. Filled ember. */
  | 'accent'
  /** A secondary commitment. Brand-tinted fill, no outline. */
  | 'tonal'
  /** A neutral alternative. Quiet fill, no outline. */
  | 'secondary'
  /** A tertiary action. Text only. */
  | 'ghost'
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
  /** Light tap feedback. On by default for filled variants. */
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
}

const SIZES: Record<ButtonSize, SizeSpec> = {
  sm: { height: 34, paddingHorizontal: 14, text: 'label', gap: 6 },
  md: { height: 46, paddingHorizontal: 18, text: 'headline', gap: 8 },
  lg: { height: 52, paddingHorizontal: 22, text: 'headline', gap: 8 },
};

/**
 * A button.
 *
 * Two changes from the earlier version worth noting. There are no outlined
 * variants: an outline is a weaker signal than a fill at the same effort, and
 * a screen of outlined buttons was part of what made this app read as
 * generated. And `tonal` exists so a secondary action can carry brand colour
 * without competing with the primary one, which removes the temptation to
 * stack three identical ghost buttons at the bottom of a screen.
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
  const spec = SIZES[size];
  const isBlocked = disabled || loading;

  const isFilled = variant === 'primary' || variant === 'accent' || variant === 'danger';
  const wantsHaptic = haptic ?? isFilled;

  const colors = (() => {
    switch (variant) {
      case 'primary':
        return { bg: theme.colors.primary, fg: theme.colors.textOnPrimary };
      case 'accent':
        return { bg: theme.colors.accent, fg: theme.colors.textOnAccent };
      case 'danger':
        return { bg: theme.colors.danger, fg: '#FFFFFF' };
      case 'tonal':
        return { bg: theme.colors.primarySoft, fg: theme.colors.primaryOnSoft };
      case 'secondary':
        return { bg: theme.colors.surfaceAlt, fg: theme.colors.text };
      case 'ghost':
      default:
        return { bg: 'transparent', fg: theme.colors.primaryOnSoft };
    }
  })();

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={isBlocked}
      haptic={wantsHaptic && !isBlocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={[
        {
          height: spec.height,
          paddingHorizontal: variant === 'ghost' ? spec.paddingHorizontal / 2 : spec.paddingHorizontal,
          borderRadius: theme.radius.control,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spec.gap,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={colors.fg} /> : leading}
      <Text variant={spec.text} color={colors.fg} numberOfLines={1}>
        {label}
      </Text>
      {trailing ? <View>{trailing}</View> : null}
    </PressableScale>
  );
}
