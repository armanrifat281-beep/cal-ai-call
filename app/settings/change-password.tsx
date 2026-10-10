import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Button,
  Disclosure,
  ErrorState,
  OfflineNotice,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import {
  useAuth,
  validatePassword,
  validatePasswordConfirmation,
} from '@/features/auth';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';

/**
 * Changing the password of a signed-in account.
 *
 * Supabase verifies the session, not a re-typed current password, so asking
 * for the old one here would be theatre: it would be checked by this screen
 * and by nothing else. What protects the account is that the session is
 * already proven, which is also why this is only reachable while signed in.
 */
export default function ChangePasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { updatePassword, isSignedIn, status } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [done, setDone] = useState(false);

  const errors = {
    password: validatePassword(password),
    confirmation: validatePasswordConfirmation(password, confirmation),
  };

  const submit = async () => {
    setShowErrors(true);
    if (errors.password !== null || errors.confirmation !== null) return;

    setBusy(true);
    setError(null);
    const result = await updatePassword(password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  };

  if (!isSignedIn) {
    return (
      <Screen edges={{ bottom: true }}>
        <ErrorState
          title="No account signed in"
          message={
            status === 'unavailable'
              ? 'This build has no account backend configured, so there is no password to change.'
              : 'Sign in first, then you can change your password here.'
          }
          onRetry={() => router.back()}
          retryLabel="Go back"
        />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen edges={{ bottom: true }} contentStyle={{ gap: theme.spacing.lg }}>
        <Icon name="check" size={34} color="primary" strokeWidth={2} />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title1">Password changed</Text>
          <Text variant="callout" color="textMuted">
            Use the new one next time you sign in on another device. You stay
            signed in here.
          </Text>
        </View>
        <Button label="Done" size="lg" fullWidth onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen
      edges={{ bottom: true }}
      contentStyle={{ gap: theme.spacing.lg }}
      footer={
        <Button
          label="Save new password"
          onPress={() => void submit()}
          loading={busy}
          size="lg"
          fullWidth
          haptic
        />
      }
    >
      <OfflineNotice message="Changing your password needs a connection." />

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? () => void submit() : undefined}
        />
      ) : null}

      <View style={{ gap: theme.spacing.base }}>
        <TextField
          label="New password"
          value={password}
          onChangeText={setPassword}
          error={showErrors ? errors.password : null}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TextField
          label="Confirm new password"
          value={confirmation}
          onChangeText={setConfirmation}
          error={showErrors ? errors.confirmation : null}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={() => void submit()}
          returnKeyType="go"
        />
      </View>

      <Disclosure
        summary="Why there is no “current password” field"
        detail="Your signed-in session is what proves the account is yours, and that is what the server checks. A current-password box here would be verified by this screen and by nothing else, which looks like security without being any."
      />
    </Screen>
  );
}
