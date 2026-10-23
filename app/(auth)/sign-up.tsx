import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import {
  AUTH_INK,
  AUTH_MUTED,
  AUTH_ORANGE,
  AuthSheet,
  AuthSheetFooter,
} from '@/features/auth/AuthSheet';
import {
  AuthButton,
  AuthCheckbox,
  AuthField,
  AuthNotice,
  AuthPrompt,
} from '@/features/auth/AuthSheetControls';
import {
  hasAnyError,
  resendConfirmationEmail,
  useAuth,
  validateSignUp,
  wordNetworkError,
} from '@/features/auth';
import { env } from '@/lib/env';
import { useIsOffline } from '@/lib/useIsOffline';
import type { AppError } from '@/lib/result';
import { usePreferencesStore } from '@/store/preferencesStore';

/**
 * Create an account.
 *
 * The name is asked for here rather than during onboarding, because it is
 * the one question whose answer the app uses immediately - the greeting at
 * the top of Home - and because a form that already has three fields can
 * carry a fourth far more cheaply than a later screen can exist at all.
 *
 * Agreeing to the terms is a checkbox rather than fine print under the
 * button. Consent that is given by pressing something labelled with a
 * different verb is not consent.
 */
export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const setPreferences = usePreferencesStore((state) => state.setPreferences);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  /*
    What the device thinks of its own connection, used only to stop the
    screen blaming it when it is fine. See `wordNetworkError`.
  */
  const isOffline = useIsOffline();
  const shownError = error ? wordNetworkError(error, isOffline) : null;
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const errors = validateSignUp(email, password, confirmation);
  const nameError =
    fullName.trim().length === 0 ? 'Tell us what to call you.' : null;

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<AppError | null>(null);

  const resend = async () => {
    setResending(true);
    setResendError(null);
    const result = await resendConfirmationEmail(email);
    setResending(false);

    if (!result.ok) {
      setResendError(result.error);
      return;
    }
    // Disabled afterwards: the sender allows very few messages an hour, and
    // a second press would spend one of them for nothing.
    setResent(true);
  };

  const submit = async () => {
    setSubmitted(true);
    if (hasAnyError(errors) || nameError || !agreed) return;

    setBusy(true);
    setError(null);
    const result = await signUp(email, password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    // Kept whatever happens next: the account may still need confirming,
    // and the greeting should be right the first time the app opens.
    setPreferences({ displayName: fullName.trim() });

    if (result.value.needsEmailConfirmation) {
      setAwaitingConfirmation(true);
      return;
    }
    router.replace('/');
  };

  /*
    Confirmation replaces the form rather than sitting above it. Leaving
    four filled fields and a Create Account button on screen after the
    account exists invites the user to press it again, which fails.
  */
  if (awaitingConfirmation) {
    return (
      <AuthSheet
        title="Check your email"
        onBack={() => setAwaitingConfirmation(false)}
        onClose={() => router.replace('/(auth)/sign-in')}
      >
        <Text variant="body" color={AUTH_INK}>
          We sent a confirmation link to{' '}
          <Text variant="body" color={AUTH_INK} style={{ fontWeight: '700' }}>
            {email}
          </Text>
          . Open it on this phone and the app will take you the rest of the way.
        </Text>

        <Text variant="footnote" color={AUTH_MUTED}>
          Nothing arrived? It can take a minute, and it is often in spam.
        </Text>

        {resendError ? (
          <AuthNotice message={resendError.message} detail={resendError.detail} />
        ) : null}

        <AuthButton
          label={resent ? 'Email sent' : 'Send it again'}
          variant="outline"
          loading={resending}
          disabled={resent}
          onPress={() => void resend()}
        />

        <AuthPrompt
          question="Already confirmed?"
          action="Sign In"
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      </AuthSheet>
    );
  }

  return (
    <AuthSheet
      title="Create Account"
      onBack={router.canGoBack() ? () => router.back() : undefined}
      onClose={() => router.replace('/(auth)/welcome')}
      sheetTop={0.14}
    >
      {!env.isSupabaseConfigured ? (
        <AuthNotice
          tone="note"
          message="No account backend in this build."
          detail="The form and its checking are real; only the request at the end has nowhere to go. Everything else works, and your meals are saved on this device."
        />
      ) : null}

      {shownError ? (
        <AuthNotice
          message={shownError.message}
          detail={shownError.detail}
          // An address that already has an account comes back as a
          // validation failure with that sentence in it; retyping the same
          // details cannot fix it, so the way out is offered here.
          action={
            shownError.message.includes('already exists')
              ? {
                  label: 'Sign in instead',
                  onPress: () => router.replace('/(auth)/sign-in'),
                }
              : undefined
          }
        />
      ) : null}

      <AuthField
        label="Full Name"
        value={fullName}
        onChangeText={setFullName}
        error={submitted ? nameError : null}
        placeholder="Your name"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />

      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={submitted ? errors.email : null}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
      />

      <AuthField
        label="Password"
        password
        value={password}
        onChangeText={setPassword}
        error={submitted ? errors.password : null}
        placeholder="At least 8 characters"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <AuthField
        label="Confirm Password"
        password
        value={confirmation}
        onChangeText={setConfirmation}
        error={submitted ? errors.confirmation : null}
        placeholder="Type it again"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void submit()}
        returnKeyType="go"
      />

      <View style={{ gap: 6 }}>
        <AuthCheckbox
          checked={agreed}
          onToggle={() => setAgreed((current) => !current)}
          accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
        >
          <Text variant="footnote" color={AUTH_MUTED}>
            I agree to the{' '}
            <Text
              variant="footnote"
              color={AUTH_ORANGE}
              style={{ fontWeight: '600' }}
              onPress={() => router.push('/settings/terms')}
              accessibilityRole="link"
            >
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text
              variant="footnote"
              color={AUTH_ORANGE}
              style={{ fontWeight: '600' }}
              onPress={() => router.push('/settings/privacy')}
              accessibilityRole="link"
            >
              Privacy Policy
            </Text>
          </Text>
        </AuthCheckbox>

        {submitted && !agreed ? (
          <Text variant="footnote" color="#C13A3A">
            Please agree to the terms before creating an account.
          </Text>
        ) : null}
      </View>

      <AuthButton
        label="Create Account"
        onPress={() => void submit()}
        loading={busy}
      />

      <AuthPrompt
        question="Already have an account?"
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
