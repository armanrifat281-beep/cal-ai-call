import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Disclosure, Screen, Text, TextField } from '@/components/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { hasAnyError, useAuth, validateSignUp } from '@/features/auth';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signUp } = useAuth();

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

  // Shown only after the server confirmed the sign-up. Nothing here is
  // asserted before the request actually succeeded.
  if (awaitingConfirmation) {
    return (
      <Screen edges={{ bottom: true }} contentStyle={{ gap: theme.spacing.lg }}>
        <Icon name="check" size={34} color="primary" strokeWidth={2} />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title1">Check your email</Text>
          <Text variant="body" color="textMuted">
            We sent a confirmation link to {email.trim()}. Open it to finish
            creating your account.
          </Text>
        </View>
        <Disclosure
          summary="Nothing arrived?"
          detail="Check your spam folder. The link can take a minute to arrive, and it expires after a while - ask for a new one from the sign-in screen if it does."
        />
        <Button
          label="Go to sign in"
          onPress={() => router.replace('/(auth)/sign-in')}
          size="lg"
          fullWidth
        />
      </Screen>
    );
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Backs up your meals, recipes and shopping lists, and syncs them across devices."
      error={error}
      onRetry={error?.retryable ? () => void submit() : undefined}
      offlineMessage="Creating an account needs a connection."
      unavailableDetail="There is no backend configured in this build, so an account cannot be created yet. The form is real and so is its checking; only the request at the end has nowhere to go. Everything in the app works without one."
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
            size="sm"
            onPress={() => router.replace('/(auth)/sign-in')}
            style={{ alignSelf: 'center' }}
          />
          <Button
            label="Continue without an account"
            variant="ghost"
            size="sm"
            onPress={() => router.replace('/(tabs)')}
            style={{ alignSelf: 'center' }}
            accessibilityHint="Everything works on this device without an account"
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
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="Confirm password"
        value={confirmation}
        onChangeText={setConfirmation}
        error={submitted ? (errors.confirmation ?? null) : null}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void submit()}
        returnKeyType="go"
      />
      <Text variant="footnote" color="textSubtle">
        Anything already saved on this device stays on this device.
      </Text>
    </AuthLayout>
  );
}
