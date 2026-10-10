import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, ErrorState, InfoNote, Screen, Text, TextField } from '@/components/ui';
import { hasAnyError, useAuth, validateSignIn } from '@/features/auth';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn, status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const errors = validateSignIn(email, password);
  const showErrors = submitted;

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

  if (status === 'unavailable') {
    return (
      <Screen contentStyle={{ gap: theme.spacing.base }}>
        <InfoNote
          title="Accounts are not set up in this build"
          body="There is no backend configured, so there is nothing to sign in to. Your meals are saved on this device and everything else in the app works normally."
          tone="neutral"
        />
        <Button
          label="Back to the app"
          onPress={() => router.replace('/(tabs)')}
          fullWidth
        />
      </Screen>
    );
  }

  return (
    <Screen
      contentStyle={{ gap: theme.spacing.lg }}
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
            onPress={() => router.replace('/(auth)/sign-up')}
            fullWidth
          />
        </>
      }
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title1">Welcome back</Text>
        <Text variant="callout" color="textMuted">
          Signing in backs up your journal and syncs it across your devices.
        </Text>
      </View>

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? () => void submit() : undefined}
        />
      ) : null}

      <View style={{ gap: theme.spacing.base }}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={showErrors ? errors.email : null}
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
          error={showErrors ? errors.password : null}
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
        />
      </View>
    </Screen>
  );
}
