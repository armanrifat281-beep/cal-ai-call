import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { env } from '@/lib/env';
import type { AppError } from '@/lib/result';

import { AuthButton, AuthDivider } from './AuthSheetControls';
import { useGoogleSignIn } from './useGoogleSignIn';

export interface AuthSheetSocialProps {
  /** Called once a provider has produced a session. */
  onSignedIn: () => void;
  /** Raised to the screen, so one error area serves the whole sheet. */
  onError: (error: AppError) => void;
}

/**
 * The provider buttons on the account sheet.
 *
 * Nothing is drawn at all when no provider is configured, and that includes
 * the rule above it - which is why the rule lives here rather than on the
 * screen. A build with neither provider set up would otherwise show an "Or"
 * with nothing under it.
 *
 * Google is only MOUNTED when its client ids exist. This is not a tidiness
 * decision: `useGoogleSignIn` calls into expo-auth-session, which throws
 * outright when the ids are missing, so rendering the button in a build
 * without them takes the whole sign-in screen down with it.
 *
 * Apple is offered on iOS only, and only when it has been configured. Apple
 * will not let an app sign a user in without a paid developer membership and
 * a native entitlement, so on every other build the button could do nothing
 * but apologise - and a control whose only possible answer is a refusal is
 * worse than no control. On Android it is not a choice anyone has, so it is
 * never drawn there.
 */
export function AuthSheetSocial({ onSignedIn, onError }: AuthSheetSocialProps) {
  const showGoogle = env.isGoogleSignInConfigured;
  const showApple = Platform.OS === 'ios' && env.isAppleSignInConfigured;

  if (!showGoogle && !showApple) return null;

  return (
    <View style={{ gap: 12 }}>
      <AuthDivider />
      {showGoogle ? <GoogleButton onSignedIn={onSignedIn} onError={onError} /> : null}
      {showApple ? <AppleButton onError={onError} /> : null}
    </View>
  );
}

/** Mounted only when the client ids exist, because the hook demands them. */
function GoogleButton({ onSignedIn, onError }: AuthSheetSocialProps) {
  const google = useGoogleSignIn(onSignedIn);

  useEffect(() => {
    if (!google.error) return;
    onError(google.error);
    google.clearError();
    // Reporting once per error, not once per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google.error]);

  return (
    <AuthButton
      label="Continue With Google"
      variant="outline"
      loading={google.busy}
      disabled={!google.available}
      onPress={google.start}
      leading={<GoogleMark />}
    />
  );
}

function AppleButton({ onError }: Pick<AuthSheetSocialProps, 'onError'>) {
  return (
    <AuthButton
      label="Continue With Apple"
      variant="outline"
      onPress={() =>
        onError({
          code: 'provider_error',
          message: 'Signing in with Apple is not available in this build.',
          detail: 'Apple sign-in needs the native entitlement to be included.',
          retryable: false,
        })
      }
      leading={<AppleMark />}
    />
  );
}

/** Google's four-colour G, drawn rather than shipped as an image. */
function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.3 6.6v5.5h7c4.1-3.8 6.6-9.4 6.6-16.1z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.8 0 10.7-1.9 14.3-5.2l-7-5.5c-1.9 1.3-4.4 2.1-7.3 2.1-5.6 0-10.4-3.8-12.1-8.9H4.7v5.6C8.3 41.3 15.6 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.9 28.5c-.4-1.3-.7-2.7-.7-4.5s.3-3.2.7-4.5v-5.6H4.7C3.1 17.1 2.2 20.4 2.2 24s.9 6.9 2.5 10.1l7.2-5.6z"
      />
      <Path
        fill="#EA4335"
        d="M24 9.5c3.2 0 6 1.1 8.2 3.2l6.2-6.2C34.7 3 29.8 1 24 1 15.6 1 8.3 5.7 4.7 13.9l7.2 5.6C13.6 14.4 18.4 9.5 24 9.5z"
      />
    </Svg>
  );
}

function AppleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#1F1A17"
        d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.2.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.6zM14.2 5.9c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z"
      />
    </Svg>
  );
}
