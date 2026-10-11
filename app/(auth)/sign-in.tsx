import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, TextField } from '@/components/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { hasAnyError, useAuth, validateSignIn } from '@/features/auth';
import type { AppError } from '@/lib/result';

/**
 * Sign in.
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
    // The auth state change propagates on its own; just leave this screen.
    router.replace('/(tabs)');
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up your meals, recipes and lists on this device."
      error={error}
      onRetry={error?.retryable ? () => void submit() : undefined}
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
          <Button
            label="Create an account instead"
            variant="ghost"
            size="sm"
            onPress={() => router.replace('/(auth)/sign-up')}
            style={{ alignSelf: 'center' }}
          />
          <Button
            label="Continue without an account"
            variant="ghost"
            size="sm"
            onPress={() => router.replace('/(tabs)')}
            style={{ alignSelf: 'center' }}
            accessibilityHint="Everything works on this device without signing in"
          />
        </>
      }
    >
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
      />
      <Button
        label="I forgot my password"
        variant="ghost"
        size="sm"
        onPress={() => router.push('/(auth)/forgot-password')}
        style={{ alignSelf: 'flex-start' }}
      />
    </AuthLayout>
  );
}
