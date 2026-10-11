import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Text } from '@/components/ui';
import { env } from '@/lib/env';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';

import { AppleButton } from './AppleButton';
import { signInWithApple } from './socialService';
import { useGoogleSignIn } from './useGoogleSignIn';

export interface SocialSignInProps {
  /** Called once a provider has produced a session. */
  onSignedIn: () => void;
  /** Raised to the screen, so one error area serves the whole page. */
  onError: (error: AppError) => void;
}

/**
 * Sign in with Apple, and with Google.
 *
 * Neither carries a provider secret; the app only ever handles a token or
 * a one-time code that Supabase verifies. Both buttons appear on every
 * platform, because both services work on every platform - Apple through
 * its own sheet on iOS and through its web flow elsewhere.
 *
 * When a provider is not configured the button is still here - the sign-in
 * page has to be a complete page - and pressing it says exactly what is
 * missing instead of opening a sheet that fails.
 */
export function SocialSignIn({ onSignedIn, onError }: SocialSignInProps) {
  const theme = useTheme();
  const [appleBusy, setAppleBusy] = useState(false);

  const pressApple = async () => {
    setAppleBusy(true);
    const result = await signInWithApple();
    setAppleBusy(false);

    if (!result.ok) {
      onError(result.error);
      return;
    }
    // Null means the user closed Apple's sheet, which is not a failure.
    if (result.value) onSignedIn();
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Separator />

      {/*
        Offered on every platform - Sign in with Apple is not an iOS-only
        service. Its own component, because Apple specifies how this button
        may look and the app's pill is not one of the permitted fills.
      */}
      <AppleButton loading={appleBusy} onPress={() => void pressApple()} />

      {/*
        Two components rather than one with a branch inside it. The request
        hook throws outright when the client ids are missing, so in an
        unconfigured build it cannot be called at all - and that is the
        build a developer opens first.
      */}
      {env.isGoogleSignInConfigured ? (
        <GoogleButton onSignedIn={onSignedIn} onError={onError} />
      ) : (
        <Button
          label="Continue with Google"
          variant="secondary"
          size="lg"
          fullWidth
          onPress={() =>
            onError({
              code: 'not_configured',
              message: env.isSupabaseConfigured
                ? 'Google sign-in is not set up in this build yet.'
                : 'Accounts are not set up in this build. Your meals are saved on this device.',
              detail:
                'Needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID plus the platform client id, and the Google provider enabled in the Supabase dashboard.',
              retryable: false,
            })
          }
          leading={<Icon name="google" size={20} />}
        />
      )}
    </View>
  );
}

/** Mounted only when the client ids exist, because the hook demands them. */
function GoogleButton({ onSignedIn, onError }: SocialSignInProps) {
  const google = useGoogleSignIn(onSignedIn);

  useEffect(() => {
    if (!google.error) return;
    onError(google.error);
    google.clearError();
    // Reporting once per error, not once per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google.error]);

  return (
    <Button
      label="Continue with Google"
      variant="secondary"
      size="lg"
      fullWidth
      loading={google.busy}
      disabled={!google.available}
      onPress={google.start}
      leading={<Icon name="google" size={20} />}
    />
  );
}

/** A hairline with "or" set into it. */
function Separator() {
  const theme = useTheme();
  const rule = {
    flex: 1,
    height: theme.hairline,
    backgroundColor: theme.colors.separator,
  };

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={rule} />
      <Text variant="caption" color="textSubtle">
        or
      </Text>
      <View style={rule} />
    </View>
  );
}
