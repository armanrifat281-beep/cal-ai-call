import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  InfoNote,
  Screen,
  Text,
} from '@/components/ui';
import {
  discardPreparedImage,
  prepareImageForUpload,
  type PreparedImage,
} from '@/features/scanner/image';
import { getAnalysisAvailability } from '@/features/scanner/service';
import type { AppError } from '@/lib/result';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

/**
 * Photo capture for the scanner.
 *
 * Capture, validation and compression all work today and run entirely on the
 * device. The analysis step needs a configured server, and when there is none
 * this screen says so plainly and offers the manual path instead. It never
 * shows invented results.
 */
export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const retainPhotos = usePreferencesStore((state) => state.preferences.retainPhotos);

  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const availability = getAnalysisAvailability();

  // A prepared photo is a temp file; clean it up if the screen goes away.
  useEffect(
    () => () => {
      if (photo) discardPreparedImage(photo.uri);
    },
    [photo],
  );

  const handlePicked = useCallback(
    async (result: ImagePicker.ImagePickerResult) => {
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      setBusy(true);
      setError(null);

      const prepared = await prepareImageForUpload(asset.uri, asset.mimeType);
      setBusy(false);

      if (!prepared.ok) {
        setError(prepared.error);
        return;
      }
      // Replacing an existing photo: drop the old temp file.
      if (photo) discardPreparedImage(photo.uri);
      setPhoto(prepared.value);
    },
    [photo],
  );

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError({
        code: 'unauthorized',
        message:
          'FoodLens needs camera access to photograph your meal. You can enable it in your device settings, or pick a photo from your library instead.',
        retryable: false,
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
      // Cropping here would cut off food and skew portion estimates.
      allowsEditing: false,
      exif: false,
    });
    await handlePicked(result);
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
      exif: false,
    });
    await handlePicked(result);
  };

  return (
    <Screen
      edges={{ bottom: true }}
      contentStyle={{ gap: theme.spacing.lg }}
      footer={
        // There is deliberately no "Analyse" button yet: the analysis endpoint
        // does not exist in this build, and a button that does nothing is
        // worse than no button. It is added with the backend step.
        <Button
          label={photo ? 'Enter this meal by hand' : 'Add a meal by hand instead'}
          variant="primary"
          onPress={() => router.replace('/entry/new')}
          size="lg"
          fullWidth
        />
      }
    >
      {!availability.available ? (
        <InfoNote
          title="Photo analysis is not set up yet"
          body={availability.reason ?? ''}
          tone="warning"
        />
      ) : null}

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? () => setError(null) : undefined}
          retryLabel="Dismiss"
        />
      ) : null}

      {photo ? (
        <Card padding="md" style={{ gap: theme.spacing.md }}>
          <Image
            source={{ uri: photo.uri }}
            style={{
              width: '100%',
              aspectRatio: photo.width / Math.max(1, photo.height),
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceAlt,
            }}
            contentFit="cover"
            accessibilityLabel="The meal photo you just captured"
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <Badge label={`${photo.width} x ${photo.height}`} tone="neutral" />
            <Badge label={`${Math.round(photo.byteSize / 1024)} KB`} tone="neutral" />
            <Badge label="Ready to upload" tone="success" />
          </View>
          <Text variant="caption" color="textMuted">
            Resized and compressed on your device before any upload.
            {retainPhotos
              ? ' Your settings keep this photo after analysis.'
              : ' Your settings delete this photo right after analysis.'}
          </Text>
          <Button
            label="Choose a different photo"
            variant="ghost"
            size="sm"
            onPress={() => void pickFromLibrary()}
          />
        </Card>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <CaptureOption
            icon="camera"
            title="Take a photo"
            body="Shoot the whole plate from above, with good light."
            onPress={() => void takePhoto()}
            disabled={busy}
          />
          <CaptureOption
            icon="gallery"
            title="Choose from library"
            body="Pick a photo you already took."
            onPress={() => void pickFromLibrary()}
            disabled={busy}
          />
        </View>
      )}

      <Card variant="soft" style={{ gap: theme.spacing.sm }}>
        <Text variant="subheading">What a photo can and cannot show</Text>
        <Text variant="bodySm" color="textMuted">
          A photo can usually identify the foods on a plate. It cannot see the
          oil a dish was cooked in, sugar stirred into a drink, or the exact
          weight of anything. Every number you get is an estimate you should
          check and correct.
        </Text>
      </Card>
    </Screen>
  );
}

function CaptureOption({
  icon,
  title,
  body,
  onPress,
  disabled,
}: {
  icon: 'camera' | 'gallery';
  title: string;
  body: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();

  return (
    <Button
      label={title}
      onPress={onPress}
      disabled={disabled}
      variant="secondary"
      size="lg"
      fullWidth
      haptic
      leading={<Icon name={icon} size={22} color="text" />}
      trailing={<Icon name="chevronRight" size={18} color="textMuted" />}
      accessibilityHint={body}
      style={{ justifyContent: 'flex-start', paddingVertical: theme.spacing.base }}
    />
  );
}
