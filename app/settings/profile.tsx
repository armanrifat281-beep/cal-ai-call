import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Avatar,
  Button,
  Disclosure,
  PressableScale,
  Row,
  Screen,
  Section,
  Surface,
  Text,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/features/auth';
import { pickAvatar, removeAvatar, useAvatarStore } from '@/features/profile';
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

  const avatarUri = useAvatarStore((state) => state.uri);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [name, setName] = useState(stored ?? '');
  const [saved, setSaved] = useState(false);

  const choosePicture = (source: 'camera' | 'library') => {
    void (async () => {
      setAvatarBusy(true);
      const result = await pickAvatar(source);
      setAvatarBusy(false);
      if (!result.ok) Alert.alert('Picture not changed', result.error.message);
    })();
  };

  const clearPicture = () => {
    void (async () => {
      setAvatarBusy(true);
      const result = await removeAvatar();
      setAvatarBusy(false);
      // The picture is gone from this phone either way; only the stored copy
      // can be left behind, and that is what the message says.
      if (!result.ok) Alert.alert('Removed on this phone', result.error.message);
    })();
  };

  /** Camera, library, and remove when there is something to remove. */
  const editPicture = () => {
    const options = ['Take a photo', 'Choose from library'];
    if (avatarUri) options.push('Remove picture');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options, 'Cancel'],
          cancelButtonIndex: options.length,
          destructiveButtonIndex: avatarUri ? 2 : undefined,
        },
        (index) => {
          if (index === 0) choosePicture('camera');
          else if (index === 1) choosePicture('library');
          else if (index === 2 && avatarUri) clearPicture();
        },
      );
      return;
    }

    Alert.alert('Profile picture', undefined, [
      { text: 'Take a photo', onPress: () => choosePicture('camera') },
      { text: 'Choose from library', onPress: () => choosePicture('library') },
      ...(avatarUri
        ? [{ text: 'Remove picture', style: 'destructive' as const, onPress: clearPicture }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

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
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <PressableScale
          onPress={editPicture}
          haptic
          accessibilityRole="button"
          accessibilityLabel={
            avatarUri ? 'Change your profile picture' : 'Add a profile picture'
          }
          scaleTo={0.95}
        >
          <Avatar name={stored} imageUri={avatarUri} size={96} />
        </PressableScale>
        <Button
          label={avatarBusy ? 'Working…' : avatarUri ? 'Change picture' : 'Add a picture'}
          variant="ghost"
          size="sm"
          onPress={editPicture}
          disabled={avatarBusy}
        />
      </View>

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
