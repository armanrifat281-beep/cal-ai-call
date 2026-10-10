import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ErrorState, InfoNote, Screen, Text, TextField } from '@/components/ui';
import { MIN_PASSWORD_LENGTH, hasAnyError, useAuth, validateSignUp } from '@/features/auth';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signUp, status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const errors = validateSignUp(email, password, confirmation);

  const submit = async () => {
    setSubmitted(true);
    if (hasAnyError(errors)) return;

    setBusy(true);
    setError(null);
    const result = await signUp(email, password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.value.needsEmailConfirmation) {
      setAwaitingConfirmation(true);
      return;
    }
    router.replace('/(tabs)');
  };

  if (status === 'unavailable') {
    return (
      <Screen contentStyle={{ gap: theme.spacing.base }}>
        <InfoNote
          title="Accounts are not set up in this build"
          body="There is no backend configured, so an account cannot be created. Your meals are saved on this device and everything else in the app works normally."
          tone="neutral"
        />
        <Button label="Back to the app" onPress={() => router.replace('/(tabs)')} fullWidth />
      </Screen>
    );
  }

  // Shown only after the server confirmed the sign-up. Nothing here is
  // asserted before the request actually succeeded.
  if (awaitingConfirmation) {
    return (
      <Screen contentStyle={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title1">Check your email</Text>
          <Text variant="body" color="textMuted">
            We sent a confirmation link to {email.trim()}. Open it to finish
            creating your account, then come back and sign in.
          </Text>
        </View>
        <Card variant="soft">
          <Text variant="callout" color="textMuted">
            Nothing arrived? Check your spam folder. The link can take a minute,
            and it expires after a while.
          </Text>
        </Card>
        <Button
          label="Go to sign in"
          onPress={() => router.replace('/(auth)/sign-in')}
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
            label="Create account"
            onPress={() => void submit()}
            loading={busy}
            size="lg"
            fullWidth
            haptic
          />
          <Button
            label="I already have an account"
            variant="ghost"
            onPress={() => router.replace('/(auth)/sign-in')}
            fullWidth
          />
        </>
      }
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title1">Create an account</Text>
        <Text variant="callout" color="textMuted">
          This backs up your journal and syncs it across devices. Meals you have
          already saved on this device stay on this device.
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
          error={submitted ? errors.email : null}
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
          help={`At least ${MIN_PASSWORD_LENGTH} characters. A short phrase works well.`}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TextField
          label="Confirm password"
          value={confirmation}
          onChangeText={setConfirmation}
          error={submitted ? errors.confirmation : null}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          onSubmitEditing={() => void submit()}
          returnKeyType="go"
        />
      </View>

      <InfoNote
        title="What we store"
        body="Your email, and the meals you choose to log. Photo analysis requests contain the photo and nothing about who you are. You can delete your account and all of its data from Profile at any time."
        tone="neutral"
      />
    </Screen>
  );
}
