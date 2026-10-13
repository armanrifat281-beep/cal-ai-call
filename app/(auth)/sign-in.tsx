import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Text, TextField } from '@/components/ui';
import { AuthBackButton } from '@/features/auth/AuthBackButton';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { SocialSignIn } from '@/features/auth/SocialSignIn';
import { hasAnyError, useAuth, validateSignIn } from '@/features/auth';
import type { AppError } from '@/lib/result';

/**
 * Sign in.
 *
 * One filled button on the screen. An earlier version had four controls of
 * near-equal weight - sign in, Google, forgot, create an account - which is
 * how a page ends up with no answer to "what do I press". Now: the button,
 * then Google under a rule, with "forgot" demoted onto the password field's
 * own label row and "create an account" written as a sentence.
 *
 * The form is here whether or not a backend is configured; what changes is
 * the notice above it and what pressing the button returns.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const errors = validateSignIn(email, password);

  const submit = async () => {
    setSubmitted(true);
    if (hasAnyError(errors)) return;

    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Through the gate rather than straight to the tabs, so a new account
    // still gets onboarding and a returning one does not.
    router.replace('/');
  };

  return (
    <AuthLayout
      title={'Know what’s\non your plate.'}
      // Only when something preceded this screen: reached as the app's
      // first screen, a back button would have nowhere to go.
      heroLeading={router.canGoBack() ? <AuthBackButton /> : undefined}
      /*
        No subtitle, and a shorter hero than the other auth screens. The
        pitch belongs on Welcome; a returning user needs the form. At the
        full height the card ran past the bottom of a phone and took
        "Create an account" with it - which is how someone with no account
        ends up signing in over and over against details that match nothing.
      */
      heroHeight={252}
      error={error}
      onRetry={error?.retryable ? () => void submit() : undefined}
      // Retrying the same details cannot fix "no such account", so the way
      // out is offered at the moment it is needed.
      errorAction={
        error?.code === 'unauthorized'
          ? {
              label: 'Create an account',
              onPress: () => router.replace('/(auth)/sign-up'),
            }
          : undefined
      }
      offlineMessage="Signing in needs a connection."
      unavailableDetail="There is no backend configured in this build, so signing in cannot work yet. The form is real and so is its checking; only the request at the end has nowhere to go. Everything else in the app works, and your meals are saved on this device."
      footer={
        <>
          <Button
            label="Sign in"
            onPress={() => void submit()}
            loading={busy}
            size="lg"
            fullWidth
            haptic
          />

          <SocialSignIn
            onSignedIn={() => router.replace('/')}
            onError={setError}
          />

          {/* A sentence, not a fourth button. */}
          <Text variant="footnote" color="textMuted" align="center">
            New here?{' '}
            <Text
              variant="footnote"
              color="primary"
              style={{ fontWeight: '700' }}
              onPress={() => router.replace('/(auth)/sign-up')}
              accessibilityRole="button"
            >
              Create an account
            </Text>
          </Text>
        </>
      }
    >
      <Text variant="title2">Welcome back</Text>

      <TextField
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
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={submitted ? errors.password : null}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void submit()}
        returnKeyType="go"
        // On the label's row, so the two fields stay one pair.
        labelAccessory={
          <Text
            variant="footnote"
            color="textMuted"
            style={{ fontWeight: '600' }}
            onPress={() => router.push('/(auth)/forgot-password')}
            accessibilityRole="button"
            accessibilityLabel="I forgot my password"
          >
            Forgot?
          </Text>
        }
      />
    </AuthLayout>
  );
}
