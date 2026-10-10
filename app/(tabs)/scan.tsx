import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';


import { Icon } from '@/components/Icon';
import {
  Button,
  Disclosure,
  ErrorState,
  Row,
  Screen,
  Section,
  Surface,
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
 * Photo capture.
 *
 * Capture, validation and compression run entirely on the device and work
 * today. Nutrition analysis needs a configured server; when there is none,
 * this screen says so once and still offers two real routes forward. There
 * is deliberately no "Analyse" button while that endpoint does not exist.
 */
export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const retainPhotos = usePreferencesStore((state) => state.preferences.retainPhotos);

  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const availability = getAnalysisAvailability();

  // A prepared photo is a temp file; clean it up when the screen goes away.
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
      if (photo) discardPreparedImage(photo.uri);
      setPhoto(prepared.value);
    },
    [photo],
  );

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      // A denied permission is a state with its own copy and its own way out,
      // not a generic failure.
      setError({
        code: 'unauthorized',
        message:
          'FoodLens does not have camera access. You can turn it on in your device settings, or pick a photo from your library instead.',
        retryable: false,
      });
      return;
    }

    await handlePicked(
      await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        // Cropping here would cut off food and skew portion estimates.
        allowsEditing: false,
        exif: false,
      }),
    );
  };

  const pickFromLibrary = async () => {
    await handlePicked(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
        exif: false,
      }),
    );
  };

  if (photo) {
    return (
      <Screen
        title="Your photo"
        edges={{ top: true }}
        contentStyle={{ gap: theme.spacing.xl }}
      >
        <Image
          source={{ uri: photo.uri }}
          style={{
            width: '100%',
            aspectRatio: photo.width / Math.max(1, photo.height),
            borderRadius: theme.radius.media,
            backgroundColor: theme.colors.surfaceAlt,
          }}
          contentFit="cover"
          accessibilityLabel="The meal photo you just captured"
        />

        <Text variant="footnote" color="textSubtle">
          {photo.width} × {photo.height} · {Math.round(photo.byteSize / 1024)} KB ·
          resized on this device
        </Text>

        <Section title="What next?" dense>
          <Surface variant="grouped">
            <Row
              title="Make this at home"
              subtitle="Works out the dish from the photo and writes a recipe"
              leading={<Icon name="recipes" size={19} color="primary" />}
              trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
              haptic
              onPress={() =>
                router.push({
                  pathname: '/recipe/create',
                  params: { mode: 'from_photo', photoUri: photo.uri },
                })
              }
            />
            <Row
              title="Log this meal"
              subtitle="Add it to today's journal, entering the foods yourself"
              leading={<Icon name="journal" size={19} color="textMuted" />}
              trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
              divided
              onPress={() => router.push('/entry/new')}
            />
          </Surface>
        </Section>

        <Button
          label="Choose a different photo"
          variant="secondary"
          onPress={() => void pickFromLibrary()}
          fullWidth
        />

        <Disclosure
          summary={
            retainPhotos
              ? 'This photo will be kept after analysis'
              : 'This photo is deleted after analysis'
          }
          detail="A photo can usually identify the foods on a plate. It cannot see the oil a dish was cooked in, sugar stirred into a drink, or the exact weight of anything. A recipe generated from a photo is a close guess at the dish, not the original cook's method. You can change photo retention in Profile."
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Scan"
      subtitle="Photograph the whole plate from above, in good light."
      edges={{ top: true }}
      contentStyle={{ gap: theme.spacing.xl }}
    >
      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? () => setError(null) : undefined}
          retryLabel="Dismiss"
        />
      ) : null}

      {/*
        The viewfinder stands in for the camera. It is the single large
        element on the screen, and tapping it is the primary action - which
        is how a camera tool behaves, rather than a form with two buttons.
      */}
      <Surface
        variant="sunken"
        style={{
          aspectRatio: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.lg,
        }}
      >
        <Icon name="scan" size={64} color="textSubtle" strokeWidth={1.2} />
        <Button
          label="Take a photo"
          onPress={() => void takePhoto()}
          loading={busy}
          variant="accent"
          size="lg"
          leading={<Icon name="camera" size={20} color={theme.colors.textOnAccent} />}
        />
        <Button
          label="Choose from library"
          variant="ghost"
          onPress={() => void pickFromLibrary()}
          disabled={busy}
        />
      </Surface>

      <Section title="Or skip the photo" dense>
        <Surface variant="grouped">
          <Row
            title="Add a meal by hand"
            subtitle="About as quick, and the numbers are yours rather than an estimate"
            leading={<Icon name="journal" size={19} color="textMuted" />}
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/entry/new')}
          />
        </Surface>
      </Section>

      {!availability.available ? (
        <Disclosure
          summary="Nutrition analysis is not set up in this build"
          detail={`${availability.reason} Capturing, validating and compressing a photo all work now; only the analysis step needs a server.`}
          tone="caution"
        />
      ) : null}
    </Screen>
  );
}
