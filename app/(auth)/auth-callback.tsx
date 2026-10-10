import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, ErrorState, Screen, Text } from '@/components/ui';
import { exchangeCodeForSession, useAuth } from '@/features/auth';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';

/**
 * Where confirmation and password-reset emails come back to.
 *
 * Both emails are sent with `foodlens://auth-callback` as their redirect, and
 * until now nothing was listening there, so every link landed on an unmatched
 * route. The link carries a one-time code; this screen spends it for a
 * session and then gets out of the way.
 *
 * Which email it was decides where the user goes next. A reset gives them a
 * session they did not choose a password for, so they are sent to choose
 * one. A confirmation just means the address is theirs, so they go into the
 * app.
 */
export default function AuthCallbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { passwordResetPending } = useAuth();

  const params = useLocalSearchParams<{
    code?: string;
    type?: string;
    error?: string;
    error_description?: string;
  }>();

  const [error, setError] = useState<AppError | null>(null);
  // The code is worth one session and one only, so a re-render must not
  // spend it twice.
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    void (async () => {
      // Supabase reports a refused or expired link in the URL itself.
      if (params.error) {
        setError({
          code: 'unauthorized',
          message:
            params.error_description?.replace(/\+/g, ' ') ??
            'That link is no longer valid. Ask for a new one.',
          retryable: false,
        });
        return;
      }

      if (!params.code) {
        setError({
          code: 'validation',
          message: 'That link is incomplete. Open the most recent email and try again.',
          retryable: false,
        });
        return;
      }

      const result = await exchangeCodeForSession(params.code);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // `type=recovery` is on the link; the PASSWORD_RECOVERY event is the
      // other signal. Either is enough, and checking both means a link that
      // omits the parameter still reaches the right screen.
      if (params.type === 'recovery' || passwordResetPending) {
        router.replace('/(auth)/reset-password');
        return;
      }
      router.replace('/(tabs)');
    })();
  }, [params.code, params.error, params.error_description, params.type, passwordResetPending, router]);

  if (error) {
    return (
      <Screen contentStyle={{ justifyContent: 'center' }}>
        <ErrorState
          title="That link did not work"
          message={error.message}
          detail={error.detail}
        />
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Send a new reset email"
            onPress={() => router.replace('/(auth)/forgot-password')}
            fullWidth
          />
          <Button
            label="Back to sign in"
            variant="ghost"
            onPress={() => router.replace('/(auth)/sign-in')}
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ justifyContent: 'center', alignItems: 'center', gap: theme.spacing.base }}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text variant="callout" color="textMuted" accessibilityLiveRegion="polite">
        Finishing up…
      </Text>
    </Screen>
  );
}
