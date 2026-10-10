import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Button,
  Disclosure,
  Row,
  Screen,
  Section,
  Surface,
  Text,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/features/auth';
import { normalizeDisplayName, validateDisplayName } from '@/lib/greeting';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

/**
 * Your profile.
 *
 * The name is stored on the device, like every other preference, so it
 * works before there is an account and survives signing out. It exists
 * because Home greets you by it; a name with nowhere to appear would be a
 * box that stores a string and shows it back.
 *
 * Everything else here is account state the user cannot edit but should be
 * able to see: which address they are signed in as, and where their data
 * actually lives.
 */
export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status, user } = useAuth();

  const stored = usePreferencesStore((state) => state.preferences.displayName);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);

  const [name, setName] = useState(stored ?? '');
  const [saved, setSaved] = useState(false);

  const error = validateDisplayName(name);
  const isDirty = normalizeDisplayName(name) !== stored;

  const save = () => {
    if (error) return;
    setPreferences({ displayName: normalizeDisplayName(name) });
    setSaved(true);
  };

  return (
    <Screen
      edges={{ bottom: true }}
      contentStyle={{ gap: theme.spacing.lg }}
      footer={
        <Button
          label={saved && !isDirty ? 'Saved' : 'Save'}
          onPress={save}
          disabled={Boolean(error) || !isDirty}
          size="lg"
          fullWidth
          haptic
          leading={
            saved && !isDirty ? <Icon name="check" size={18} color="text" /> : undefined
          }
        />
      }
    >
      <View style={{ gap: theme.spacing.base }}>
        <TextField
          label="What should we call you?"
          value={name}
          onChangeText={(next) => {
            setName(next);
            setSaved(false);
          }}
          error={error}
          placeholder="Your name"
          help="Used to greet you on the Home screen. Leave it empty for no greeting."
          autoCapitalize="words"
          autoComplete="name"
          maxLength={40}
        />
      </View>

      <Section title="Account" dense>
        <Surface variant="grouped">
          {status === 'signed_in' ? (
            <Row
              title={user?.email ?? 'Signed in'}
              subtitle="Your meals, recipes and lists are backed up to this account"
              leading={<Icon name="profile" size={19} color="primary" />}
            />
          ) : (
            <Row
              title="No account"
              subtitle="Everything is saved on this device only"
              leading={<Icon name="info" size={19} color="textMuted" />}
            />
          )}
          {status === 'signed_in' ? (
            <Row
              title="Change password"
              divided
              trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
              onPress={() => router.push('/settings/change-password')}
            />
          ) : null}
        </Surface>
      </Section>

      <Disclosure
        summary="Your name stays on this device"
        detail="It is stored with your other preferences rather than sent anywhere, and it is not used to identify you. Signing out does not clear it."
      />

      <Text variant="footnote" color="textSubtle">
        Your goal, dietary preferences, allergens and targets are under Food in
        Settings.
      </Text>
    </Screen>
  );
}
