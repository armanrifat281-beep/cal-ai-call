import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Button,
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
 * Choosing a new password, after a reset link.
 *
 * Reaching this screen means the reset link has already been spent for a
 * session, so the user is technically signed in while holding a password
 * they do not know. There is no "current password" field for that reason:
 * the link was the proof.
 *
 * Backing out signs nothing out, but it does clear the pending flag, so the
 * app stops insisting. The old password still works until this is finished.
 */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { updatePassword, clearPasswordReset } = useAuth();

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
  const hasErrors = errors.password !== null || errors.confirmation !== null;

  const submit = async () => {
    setShowErrors(true);
    if (hasErrors) return;

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

  if (done) {
    return (
      <Screen contentStyle={{ gap: theme.spacing.lg, justifyContent: 'center' }}>
        <Icon name="check" size={34} color="primary" strokeWidth={2} />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title1">Password changed</Text>
          <Text variant="callout" color="textMuted">
            You are signed in on this device. Use the new password next time
            you sign in anywhere else.
          </Text>
        </View>
        <Button
          label="Continue"
          size="lg"
          fullWidth
          onPress={() => router.replace('/(tabs)')}
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
            label="Save new password"
            onPress={() => void submit()}
            loading={busy}
            size="lg"
            fullWidth
            haptic
          />
          <Button
            label="Not now"
            variant="ghost"
            onPress={() => {
              clearPasswordReset();
              router.replace('/(tabs)');
            }}
            style={{ alignSelf: 'center' }}
            accessibilityHint="Keeps your current password"
          />
        </>
      }
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title1">Choose a new password</Text>
        <Text variant="callout" color="textMuted">
          Your reset link checked out. Pick a password and you are done.
        </Text>
      </View>

      <OfflineNotice message="Saving a new password needs a connection." />

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
    </Screen>
  );
}
