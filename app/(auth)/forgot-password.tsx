import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Disclosure, Screen, Text, TextField } from '@/components/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';
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
      <Screen edges={{ bottom: true }} contentStyle={{ gap: theme.spacing.lg }}>
        <Icon name="check" size={34} color="primary" strokeWidth={2} />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title1">Check your email</Text>
          {/*
            Worded so it does not reveal whether an account exists for this
            address. Saying "no account found" would turn this form into a
            way to discover who has signed up.
          */}
          <Text variant="body" color="textMuted">
            If there is an account for {email.trim()}, a reset link is on its
            way. Open it to choose a new password.
          </Text>
        </View>
        <Disclosure
          summary="Nothing arrived?"
          detail="Check your spam folder, and make sure the address is the one you signed up with. The link expires after a while; ask for another from here if it does."
        />
        <Button
          label="Back to sign in"
          onPress={() => router.replace('/(auth)/sign-in')}
          size="lg"
          fullWidth
        />
      </Screen>
    );
  }

  return (
    <AuthLayout
      title={'Reset your\npassword'}
      heroHeight={300}
      subtitle="Tell us the address you signed up with and we will send a link to choose a new password."
      error={error}
      onRetry={error?.retryable ? () => void submit() : undefined}
      offlineMessage="Sending a reset link needs a connection."
      unavailableDetail="There is no backend configured in this build, so no email can be sent yet. The form is real and so is its checking; only the request at the end has nowhere to go."
      footer={
        <>
          <Button
            label="Send a reset link"
            onPress={() => void submit()}
            loading={busy}
            size="lg"
            fullWidth
            haptic
          />
          <Button
            label="Back to sign in"
            variant="ghost"
            size="sm"
            onPress={() => router.replace('/(auth)/sign-in')}
            style={{ alignSelf: 'center' }}
          />
        </>
      }
    >
      <TextField
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
    </AuthLayout>
  );
}
