import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Text } from '@/components/ui';
import {
  AUTH_INK,
  AUTH_MUTED,
  AuthSheet,
  AuthSheetFooter,
} from '@/features/auth/AuthSheet';
import {
  AuthButton,
  AuthField,
  AuthNotice,
  AuthPrompt,
} from '@/features/auth/AuthSheetControls';
import { useAuth, validateEmail, wordNetworkError } from '@/features/auth';
import { env } from '@/lib/env';
import { useIsOffline } from '@/lib/useIsOffline';
import type { AppError } from '@/lib/result';

/**
 * Ask for a reset link.
 *
 * Drawn on the same sheet as the rest of the account flow, not on the app's
 * own black page: a user who taps "Forgot Password?" has not left signing
 * in, and a screen in a different palette says they have.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  /*
    What the device thinks of its own connection, used only to stop the
    screen blaming it when it is fine. See `wordNetworkError`.
  */
  const isOffline = useIsOffline();
  const shownError = error ? wordNetworkError(error, isOffline) : null;

  const emailError = validateEmail(email);

  const submit = async () => {
    setSubmitted(true);
    if (emailError) return;

    setBusy(true);
    setError(null);
    const result = await requestPasswordReset(email);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthSheet
        title="Check your email"
        onClose={() => router.replace('/(auth)/sign-in')}
      >
        {/*
          Worded so it does not reveal whether an account exists for this
          address. Saying "no account found" would turn this form into a way
          to discover who has signed up.
        */}
        <Text variant="body" color={AUTH_INK}>
          If there is an account for{' '}
          <Text variant="body" color={AUTH_INK} style={{ fontWeight: '700' }}>
            {email.trim()}
          </Text>
          , a reset link is on its way. Open it to choose a new password.
        </Text>

        <Text variant="footnote" color={AUTH_MUTED}>
          Nothing arrived? Check spam, and make sure the address is the one
          you signed up with. The link expires after a while; ask for another
          from here if it does.
        </Text>

        <AuthButton
          label="Back to Sign In"
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      </AuthSheet>
    );
  }

  return (
    <AuthSheet
      title="Reset Password"
      onBack={router.canGoBack() ? () => router.back() : undefined}
      onClose={() => router.replace('/(auth)/sign-in')}
    >
      <Text variant="body" color={AUTH_MUTED}>
        Tell us the address you signed up with and we will send a link to
        choose a new password.
      </Text>

      {!env.isSupabaseConfigured ? (
        <AuthNotice
          tone="note"
          message="No account backend in this build."
          detail="No email can be sent yet. The form is real and so is its checking; only the request at the end has nowhere to go."
        />
      ) : null}

      {shownError ? (
        <AuthNotice message={shownError.message} detail={shownError.detail} />
      ) : null}

      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={submitted ? emailError : null}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
        onSubmitEditing={() => void submit()}
        returnKeyType="go"
      />

      <AuthButton
        label="Send a reset link"
        onPress={() => void submit()}
        loading={busy}
      />

      <AuthPrompt
        question="Remembered it?"
        action="Sign In"
        onPress={() => router.replace('/(auth)/sign-in')}
      />

      <AuthSheetFooter>
        <Text variant="caption" color={AUTH_MUTED}>
          © {new Date().getFullYear()} FoodLens AI
        </Text>
      </AuthSheetFooter>
    </AuthSheet>
  );
}
