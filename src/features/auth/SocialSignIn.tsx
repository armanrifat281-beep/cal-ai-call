import { useEffect } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Text } from '@/components/ui';
import { env } from '@/lib/env';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';

import { useGoogleSignIn } from './useGoogleSignIn';

export interface SocialSignInProps {
  /** Called once a provider has produced a session. */
  onSignedIn: () => void;
  /** Raised to the screen, so one error area serves the whole page. */
  onError: (error: AppError) => void;
}

/**
 * Sign in with Google.
 *
 * It carries no provider secret; the app only ever handles an identity token
 * that Supabase verifies.
 *
 * Sign in with Apple is not offered. This app ships on Android, and Apple's
 * provider cannot be configured without a paid Apple Developer membership -
 * so a button for it could only ever say "not set up".
 *
 * When Google is not configured, nothing is drawn at all.
 *
 * An earlier version kept the button and explained what was missing when it
 * was pressed. That reads as a complete page to whoever is building it and
 * as a broken button to everyone else: the control looks identical to the
 * working one, the message lands at the top of the form where the user is
 * not looking, and pressing it again does the same nothing. A control that
 * can never do its job should not be on the screen.
 *
 * It returns on its own the moment the client ids are set, along with the
 * "or" rule above it, so configuring Google is the only step.
 */
export function SocialSignIn({ onSignedIn, onError }: SocialSignInProps) {
  const theme = useTheme();

  // Nothing to draw: no working provider, so no separator and no button.
  if (!env.isGoogleSignInConfigured) return null;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Separator />
      <GoogleButton onSignedIn={onSignedIn} onError={onError} />
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
