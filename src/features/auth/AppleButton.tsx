import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { isNativeAppleAvailable } from './socialService';

export interface AppleButtonProps {
  onPress: () => void;
  loading?: boolean;
  /** Matches the height of the app's large button, so the row lines up. */
  height?: number;
}

/**
 * Sign in with Apple, drawn the way Apple requires.
 *
 * Apple's Human Interface Guidelines do not treat this as an ordinary
 * button. The background may be black, white, or white with an outline and
 * nothing else; the mark, its size, the text and the padding are specified.
 * A button in the app's own colours is a review risk, and it was one: these
 * were the app's ink pill, which is near-black and near-white rather than
 * black and white.
 *
 * On iOS the system draws it. That removes the question entirely and
 * localises the label for free - a Bengali phone renders Bengali without
 * the app shipping a translation.
 *
 * Everywhere else Apple's web flow is used, so there is no system button to
 * ask for and the rules still apply. The fallback below follows them
 * exactly: pure black or pure white, chosen so the button reads against the
 * page, with the mark reversed out of it.
 */
export function AppleButton({ onPress, loading = false, height = 62 }: AppleButtonProps) {
  const theme = useTheme();
  const [native, setNative] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isNativeAppleAvailable().then((available) => {
      if (!cancelled) setNative(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Still deciding. Reserving the space stops the row jumping once it knows.
  if (native === null) return <View style={{ height }} />;

  if (native) {
    return (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        // Light on a dark page, dark on a light one, matching how every
        // other filled button in the app inverts.
        buttonStyle={
          theme.scheme === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={height / 2}
        style={{ width: '100%', height }}
        onPress={onPress}
      />
    );
  }

  // Apple's two permitted fills, exactly: not the app's near-black and
  // near-white, which are close enough to look right and not close enough
  // to be the thing Apple asked for.
  const onDark = theme.scheme === 'dark';
  const background = onDark ? '#FFFFFF' : '#000000';
  const foreground = onDark ? '#000000' : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple"
      accessibilityState={{ disabled: loading, busy: loading }}
      style={({ pressed }) => ({
        height,
        borderRadius: height / 2,
        backgroundColor: background,
        opacity: pressed || loading ? 0.85 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <Icon name="apple" size={20} color={foreground} />
      )}
      <Text variant="title2" color={foreground}>
        Continue with Apple
      </Text>
    </Pressable>
  );
}
