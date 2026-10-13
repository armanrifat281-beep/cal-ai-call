import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Button,
  Disclosure,
  ErrorState,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import { AuthBackButton } from '@/features/auth/AuthBackButton';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { SocialSignIn } from '@/features/auth/SocialSignIn';
import {
  hasAnyError,
  resendConfirmationEmail,
  useAuth,
  validateSignUp,
} from '@/features/auth';
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
    router.replace('/');
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
          detail="Check your spam folder first - the link can take a minute. If it still has not come, send it again below. The link expires after a while, and a fresh one always works."
        />

        {resendError ? (
          <ErrorState message={resendError.message} detail={resendError.detail} />
        ) : null}

        {/*
          Without this, an email that never arrives is the end of the road:
          the sign-in screen only offers a password reset, which does not
          confirm an address, so the account stays unreachable and the email
          is already taken.
        */}
        <Button
          label={resent ? 'Sent again' : 'Send the email again'}
          onPress={() => void resend()}
          loading={resending}
          disabled={resent}
          size="lg"
          fullWidth
          haptic
        />
        <Button
          label="Go to sign in"
          variant="ghost"
          onPress={() => router.replace('/(auth)/sign-in')}
          style={{ alignSelf: 'center' }}
        />
      </Screen>
    );
  }

  return (
    <AuthLayout
      title={'Create your\naccount'}
      heroLeading={router.canGoBack() ? <AuthBackButton /> : undefined}
      heroHeight={240}
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

      <SocialSignIn
        onSignedIn={() => router.replace('/')}
        onError={setError}
      />
    </AuthLayout>
  );
}
