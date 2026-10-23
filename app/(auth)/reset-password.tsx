import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Text } from '@/components/ui';
import {
  AUTH_MUTED,
  AuthSheet,
  AuthSheetFooter,
} from '@/features/auth/AuthSheet';
import {
  AuthButton,
  AuthField,
  AuthNotice,
} from '@/features/auth/AuthSheetControls';
import {
  useAuth,
  validatePassword,
  validatePasswordConfirmation,
} from '@/features/auth';
import type { AppError } from '@/lib/result';

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
      <AuthSheet title="Password changed">
        <Text variant="body" color={AUTH_MUTED}>
          You are signed in on this device. Use the new password next time you
          sign in anywhere else.
        </Text>
        <AuthButton label="Continue" onPress={() => router.replace('/(tabs)')} />
      </AuthSheet>
    );
  }

  return (
    <AuthSheet title="New Password">
      <Text variant="body" color={AUTH_MUTED}>
        Your reset link checked out. Pick a password and you are done.
      </Text>

      {error ? <AuthNotice message={error.message} detail={error.detail} /> : null}

      <AuthField
        label="New Password"
        password
        value={password}
        onChangeText={setPassword}
        error={showErrors ? errors.password : null}
        placeholder="At least 8 characters"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <AuthField
        label="Confirm New Password"
        password
        value={confirmation}
        onChangeText={setConfirmation}
        error={showErrors ? errors.confirmation : null}
        placeholder="Type it again"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void submit()}
        returnKeyType="go"
      />

      <AuthButton
        label="Save new password"
        onPress={() => void submit()}
        loading={busy}
      />

      <AuthButton
        label="Not now"
        variant="outline"
        onPress={() => {
          clearPasswordReset();
          router.replace('/(tabs)');
        }}
      />

      <AuthSheetFooter>
        <Text variant="caption" color={AUTH_MUTED}>
          © {new Date().getFullYear()} FoodLens AI
        </Text>
      </AuthSheetFooter>
    </AuthSheet>
  );
}
