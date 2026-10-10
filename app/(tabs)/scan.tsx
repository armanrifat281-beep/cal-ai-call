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
 * Photo capture.
 *
 * Capture, validation and compression all work today and run entirely on the
 * device. Nutrition analysis needs a configured server; when there is none,
 * this screen says so and still offers two real routes forward:
 *
 *   "Make this at home"  - sends the photo to the recipe creator, which
 *                          identifies the dish itself from the photo.
 *   "Log this meal"      - opens manual entry, which needs nothing.
 *
 * Neither is a placeholder. There is deliberately no "Analyse" button while
 * the analysis endpoint does not exist.
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

  const makeAtHome = () => {
    if (!photo) return;
    router.push({
      pathname: '/recipe/create',
      params: { mode: 'from_photo', photoUri: photo.uri },
    });
  };

  return (
    <Screen edges={{ top: true }} contentStyle={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title">Scan a meal</Text>
        <Text variant="bodySm" color="textMuted">
          Shoot the whole plate from above, with good light.
        </Text>
      </View>

      {!availability.available ? (
        <InfoNote
          title="Nutrition analysis is not set up yet"
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
        <>
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
              <Badge label="Ready" tone="success" />
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

          <View style={{ gap: theme.spacing.md }}>
            <Text variant="heading">What next?</Text>

            <ActionCard
              icon="recipes"
              title="Make this at home"
              body="Sends the photo to the recipe creator, which works out what the dish is and writes a recipe for it."
              onPress={makeAtHome}
              primary
            />

            <ActionCard
              icon="journal"
              title="Log this meal"
              body="Adds it to today's journal. You enter the foods, so this works without any analysis."
              onPress={() => router.push('/entry/new')}
            />
          </View>

          <InfoNote
            title="What a photo cannot show"
            body="A photo can usually identify the foods on a plate. It cannot see the oil a dish was cooked in, sugar stirred into a drink, or the exact weight of anything. A recipe generated from a photo is a close guess at the dish, not the original cook's method."
            tone="warning"
          />
        </>
      ) : (
        <>
          <View style={{ gap: theme.spacing.md }}>
            <Button
              label="Take a photo"
              onPress={() => void takePhoto()}
              disabled={busy}
              loading={busy}
              variant="accent"
              size="lg"
              fullWidth
              haptic
              leading={<Icon name="camera" size={22} color={theme.colors.textOnAccent} />}
            />
            <Button
              label="Choose from library"
              onPress={() => void pickFromLibrary()}
              disabled={busy}
              variant="secondary"
              size="lg"
              fullWidth
              leading={<Icon name="gallery" size={22} color="text" />}
            />
          </View>

          <Card variant="soft" style={{ gap: theme.spacing.sm }}>
            <Text variant="subheading">You can also skip the photo</Text>
            <Text variant="bodySm" color="textMuted">
              Adding a meal by hand takes about as long and the numbers are
              yours rather than an estimate.
            </Text>
            <Button
              label="Add a meal by hand"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/entry/new')}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}

function ActionCard({
  icon,
  title,
  body,
  onPress,
  primary = false,
}: {
  icon: 'recipes' | 'journal';
  title: string;
  body: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const theme = useTheme();

  return (
    <Card
      variant={primary ? 'soft' : 'outlined'}
      style={{
        gap: theme.spacing.sm,
        backgroundColor: primary ? theme.colors.primarySoft : theme.colors.surface,
        borderColor: primary ? theme.colors.primary : theme.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Icon name={icon} size={22} color={primary ? 'primaryOnSoft' : 'text'} />
        <Text variant="subheading" color={primary ? 'primaryOnSoft' : 'text'}>
          {title}
        </Text>
      </View>
      <Text variant="bodySm" color={primary ? 'primaryOnSoft' : 'textMuted'}>
        {body}
      </Text>
      <Button
        label={title}
        variant={primary ? 'primary' : 'secondary'}
        onPress={onPress}
        fullWidth
        haptic
      />
    </Card>
  );
}
