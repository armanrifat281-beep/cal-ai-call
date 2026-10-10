import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ErrorState, Screen, Text, TextField } from '@/components/ui';
import { useAuth, validateEmail } from '@/features/auth';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

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
      <Screen contentStyle={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title">Check your email</Text>
          {/*
            Worded so it does not reveal whether an account exists for this
            address. Saying "no account found" would turn this form into a way
            to discover who has signed up.
          */}
          <Text variant="body" color="textMuted">
            If there is an account for {email.trim()}, a reset link is on its
            way. Open it to choose a new password.
          </Text>
        </View>
        <Card variant="soft">
          <Text variant="bodySm" color="textMuted">
            Nothing arrived within a few minutes? Check your spam folder, and
            make sure the address is the one you signed up with.
          </Text>
        </Card>
        <Button
          label="Back to sign in"
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
        <Button
          label="Send reset link"
          onPress={() => void submit()}
          loading={busy}
          size="lg"
          fullWidth
          haptic
        />
      }
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title">Reset your password</Text>
        <Text variant="bodySm" color="textMuted">
          Enter the email you signed up with and we will send a link to set a
          new password.
        </Text>
      </View>

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? () => void submit() : undefined}
        />
      ) : null}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={submitted ? emailError : null}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
        onSubmitEditing={() => void submit()}
        returnKeyType="go"
      />
    </Screen>
  );
}
