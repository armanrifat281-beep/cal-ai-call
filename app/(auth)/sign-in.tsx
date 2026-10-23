import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import {
  AUTH_MUTED,
  AUTH_ORANGE,
  AuthSheet,
  AuthSheetFooter,
} from '@/features/auth/AuthSheet';
import {
  AuthButton,
  AuthField,
  AuthNotice,
  AuthPrompt,
} from '@/features/auth/AuthSheetControls';
import { AuthSheetSocial } from '@/features/auth/AuthSheetSocial';
import {
  hasAnyError,
  useAuth,
  validateSignIn,
  wordNetworkError,
} from '@/features/auth';
import { env } from '@/lib/env';
import { useIsOffline } from '@/lib/useIsOffline';
import type { AppError } from '@/lib/result';

/**
 * Sign in.
 *
 * One filled button on the sheet. Everything else is quieter than it:
 * "Forgot Password?" is a line of text under the button rather than a third
 * control, the providers sit below a rule, and "Sign Up" is a word inside a
 * sentence. A screen with four controls of equal weight has no answer to
 * "what do I press".
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

  /*
    What the device thinks of its own connection, used only to stop the
    screen blaming it when it is fine. See `wordNetworkError`.
  */
  const isOffline = useIsOffline();
  const shownError = error ? wordNetworkError(error, isOffline) : null;

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
    <AuthSheet
      badge
      // Only when something preceded this screen: reached as the app's first
      // screen, a close button would have nowhere to go.
      onClose={router.canGoBack() ? () => router.back() : undefined}
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
          // Retrying the same details cannot fix "no such account", so the
          // way out is offered at the moment it is needed.
          action={
            shownError.code === 'unauthorized'
              ? {
                  label: 'Create an account instead',
                  onPress: () => router.replace('/(auth)/sign-up'),
                }
              : undefined
          }
        />
      ) : null}

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
        placeholder="Your password"
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void submit()}
        returnKeyType="go"
      />

      <View style={{ gap: 12, marginTop: 6 }}>
        <AuthButton label="Sign In" onPress={() => void submit()} loading={busy} />

        <Text
          variant="footnote"
          color={AUTH_ORANGE}
          align="center"
          style={{ fontWeight: '600' }}
          onPress={() => router.push('/(auth)/forgot-password')}
          accessibilityRole="button"
          accessibilityLabel="I forgot my password"
        >
          Forgot Password?
        </Text>
      </View>

      {/* Draws its own rule, or nothing at all when no provider is set up. */}
      <AuthSheetSocial onSignedIn={() => router.replace('/')} onError={setError} />

      <AuthPrompt
        question="Don't have an account?"
        action="Sign Up"
        onPress={() => router.replace('/(auth)/sign-up')}
      />

      <AuthSheetFooter>
        <Text variant="caption" color={AUTH_MUTED}>
          © {new Date().getFullYear()} FoodLens AI
        </Text>
      </AuthSheetFooter>
    </AuthSheet>
  );
}
