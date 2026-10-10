import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Screen, Text } from '@/components/ui';
import { saveDishPhoto } from '@/features/photos';
import { prepareImageForUpload } from '@/features/scanner/image';
import { useTheme } from '@/theme';

export interface CookedScreenProps {
  recipeId: string;
  recipeTitle: string;
  onDone: () => void;
}

/**
 * The moment after the last step.
 *
 * Cooking previously ended by closing the screen, which made finishing feel
 * like cancelling. This marks it, and asks for the one thing the app cannot
 * produce on its own: a photograph of the actual dish.
 *
 * That is also the honest answer to wanting real food photography in a
 * recipe app. No image provider is configured, and the app will not invent
 * a picture of a dish nobody cooked - but the person who just cooked it has
 * one, and from then on their recipe carries it.
 *
 * Skipping is a plain, equal option. Nothing here nags.
 */
export function CookedScreen({ recipeId, recipeTitle, onDone }: CookedScreenProps) {
  const theme = useTheme();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const capture = async (source: 'camera' | 'library') => {
    setFailed(false);

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        // No camera access is a reason to offer the library, not an error.
        await capture('library');
        return;
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], exif: false })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            exif: false,
          });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    setBusy(true);
    const prepared = await prepareImageForUpload(asset.uri, asset.mimeType);
    if (!prepared.ok) {
      setBusy(false);
      setFailed(true);
      return;
    }

    const saved = await saveDishPhoto(recipeId, prepared.value.uri);
    setBusy(false);

    if (!saved.ok) {
      setFailed(true);
      return;
    }
    setPhotoUri(saved.value);
  };

  return (
    <Screen
      edges={{ top: true, bottom: true }}
      contentStyle={{ gap: theme.spacing.xl, justifyContent: 'center' }}
      footer={
        <Button
          label={photoUri ? 'Done' : 'Finish without a photo'}
          variant={photoUri ? 'primary' : 'secondary'}
          size="lg"
          fullWidth
          onPress={onDone}
        />
      }
    >
      <View style={{ gap: theme.spacing.md }}>
        <Icon name="check" size={34} color="primary" strokeWidth={2} />
        <Text variant="display">You cooked it.</Text>
        <Text variant="body" color="textMuted">
          {recipeTitle} is marked as cooked, so it will turn up under “Cook it
          again”.
        </Text>
      </View>

      {photoUri ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Image
            source={{ uri: photoUri }}
            style={{
              width: '100%',
              aspectRatio: 4 / 3,
              borderRadius: theme.radius.media,
              backgroundColor: theme.colors.surfaceAlt,
            }}
            contentFit="cover"
            transition={220}
            accessibilityLabel={`Your photo of ${recipeTitle}`}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="check" size={15} color="success" />
            <Text variant="footnote" color="textMuted">
              Saved to this recipe, on this device
            </Text>
          </View>
          <Button
            label="Take a different one"
            variant="ghost"
            size="sm"
            onPress={() => void capture('camera')}
          />
        </View>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="headline">Add a photo of yours?</Text>
          <Text variant="footnote" color="textMuted">
            Your recipe will show your dish instead of a stand-in. It stays on
            this device.
          </Text>
          {failed ? (
            <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
              That photo could not be saved. You can try again, or finish
              without one.
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              label="Take a photo"
              onPress={() => void capture('camera')}
              loading={busy}
              leading={<Icon name="camera" size={18} color={theme.colors.textOnCta} />}
              style={{ flex: 1 }}
            />
            <Button
              label="Choose"
              variant="secondary"
              onPress={() => void capture('library')}
              disabled={busy}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}
