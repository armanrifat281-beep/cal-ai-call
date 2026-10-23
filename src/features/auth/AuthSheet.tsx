import { LinearGradient } from 'expo-linear-gradient';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui';

/**
 * The shell every account screen is drawn in.
 *
 * Deliberately outside the theme, exactly as the welcome screen is. The rest
 * of the app is a black page with a lime accent; the account screens are a
 * warm orange with a cream sheet riding up over it. That is not a second
 * theme the app can be in - it is one moment, before the app proper starts -
 * so its colours are written here as literals rather than added to a palette
 * that every other screen reads. A token meaning "orange even in dark mode"
 * would be a lie to every screen that asked for it.
 *
 * The sheet is the screen. Everything an account screen needs - the fields,
 * the button, the way back - sits inside one rounded panel that starts below
 * the fold, which is what makes signing in feel like a drawer pulled over the
 * app rather than another page of it.
 */

export const AUTH_ORANGE = '#FF6B35';
export const AUTH_ORANGE_DEEP = '#EF5A22';
/** The card peeking out behind the sheet, for depth. */
const AUTH_ORANGE_PALE = '#FFA077';
export const AUTH_SHEET = '#FFF8F2';
export const AUTH_INK = '#1F1A17';
export const AUTH_MUTED = '#8C8178';
export const AUTH_FIELD_BORDER = '#EFE3D8';
export const AUTH_FIELD_BG = '#FFFFFF';

export interface AuthSheetProps {
  children: React.ReactNode;
  /** Centred in the sheet's header row. Omit for the badge treatment. */
  title?: string;
  /** Draws the round brand badge straddling the sheet's top edge. */
  badge?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  /** How far down the screen the sheet begins, 0..1. */
  sheetTop?: number;
}

export function AuthSheet({
  children,
  title,
  badge = false,
  onBack,
  onClose,
  sheetTop = 0.21,
}: AuthSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: AUTH_ORANGE }}>
      {/*
        The orange is a gradient, not a flat fill. Flat, it reads as a
        placeholder colour; the slight lift towards the top is what makes it
        look like a lit surface the sheet is sitting on.
      */}
      <LinearGradient
        colors={[AUTH_ORANGE, AUTH_ORANGE_DEEP]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* The orange above the sheet. Pure space: the sheet is the subject. */}
          <View style={{ height: `${Math.round(sheetTop * 100)}%`, minHeight: 112 }} />

          <View style={{ flex: 1 }}>
            {/*
              A second, paler card showing a few points above the sheet and
              inset at both sides. One sheet alone sits on the orange like a
              sticker; two make it a stack being drawn out of the page.
            */}
            <View
              style={{
                position: 'absolute',
                top: -14,
                left: 14,
                right: 14,
                height: 80,
                borderTopLeftRadius: 34,
                borderTopRightRadius: 34,
                backgroundColor: AUTH_ORANGE_PALE,
              }}
              pointerEvents="none"
            />

            <View
              style={{
                flex: 1,
                backgroundColor: AUTH_SHEET,
                borderTopLeftRadius: 34,
                borderTopRightRadius: 34,
                paddingHorizontal: 26,
                paddingTop: badge ? 46 : 22,
                paddingBottom: insets.bottom + 22,
              }}
            >
              {/*
                The badge straddles the sheet's edge rather than sitting
                inside it, which is what ties the cream panel to the orange
                behind it instead of leaving them as two stacked rectangles.
              */}
              {badge ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -34,
                    left: 24,
                    width: 68,
                    height: 68,
                    borderRadius: 34,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AuthSpark size={34} color={AUTH_ORANGE} />
                </View>
              ) : null}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 32,
                  marginBottom: title ? 18 : 6,
                }}
              >
                <View style={{ width: 32, alignItems: 'flex-start' }}>
                  {onBack ? (
                    <SheetIconButton
                      onPress={onBack}
                      accessibilityLabel="Go back"
                      glyph="back"
                    />
                  ) : null}
                </View>

                {title ? (
                  <Text
                    variant="title2"
                    color={AUTH_INK}
                    style={{ fontWeight: '700', fontSize: 20 }}
                  >
                    {title}
                  </Text>
                ) : (
                  <View />
                )}

                <View style={{ width: 32, alignItems: 'flex-end' }}>
                  {onClose ? (
                    <SheetIconButton
                      onPress={onClose}
                      accessibilityLabel="Close"
                      glyph="close"
                    />
                  ) : null}
                </View>
              </View>

              <View style={{ gap: 16 }}>{children}</View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * The footer line every account screen ends with.
 *
 * Its own component because it is the one piece of furniture that must be
 * identical on all of them; written out per screen, three of the four drifted
 * in size or colour the first time any of them was touched.
 */
export function AuthSheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <Text
      variant="caption"
      color={AUTH_MUTED}
      align="center"
      style={{ marginTop: 18 }}
    >
      {children}
    </Text>
  );
}

/** The four-pointed spark the brand badge is drawn from. */
export function AuthSpark({ size = 32, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/*
        Four cusps pulled towards the centre with cubics rather than a
        straight-sided star: the concave waist is what makes it read as a
        spark instead of a compass rose.
      */}
      <Path
        d="M50 2 C56 32 68 44 98 50 C68 56 56 68 50 98 C44 68 32 56 2 50 C32 44 44 32 50 2 Z"
        fill={color}
      />
    </Svg>
  );
}

function SheetIconButton({
  onPress,
  accessibilityLabel,
  glyph,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  glyph: 'back' | 'close';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      // The glyph is small by design; the touch target around it is not.
      hitSlop={14}
      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24">
        {glyph === 'back' ? (
          <Path
            d="M15 5 L8 12 L15 19"
            stroke={AUTH_INK}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : (
          <Path
            d="M6 6 L18 18 M18 6 L6 18"
            stroke={AUTH_INK}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </Svg>
    </Pressable>
  );
}
