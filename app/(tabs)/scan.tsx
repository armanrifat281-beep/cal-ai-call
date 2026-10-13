import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


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
  OfflineNotice,
} from '@/components/ui';
import { useAuth } from '@/features/auth';
import { MealActions, useJournalRepository } from '@/features/journal';
import { mealTypeForHour } from '@/features/journal/MealEditor';
import { AnalysisResult } from '@/features/scanner/AnalysisResult';
import { CameraCapture } from '@/features/scanner/CameraCapture';
import { analysisToEntryItems } from '@/features/scanner/toEntryItems';
import type { MealAnalysis } from '@/features/scanner/types';
import {
  discardPreparedImage,
  prepareImageForUpload,
  type PreparedImage,
} from '@/features/scanner/image';
import {
  analyzeMealPhoto,
  getAnalysisAvailability,
} from '@/features/scanner/service';
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
  const insets = useSafeAreaInsets();
  const retainPhotos = usePreferencesStore((state) => state.preferences.retainPhotos);

  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  /*
    Set once the server says it has no analysis configured.

    `getAnalysisAvailability` can only see whether Supabase is configured -
    whether the provider key is set lives on the server, and the only way
    to find out is to ask. Having asked and been told no, the button stops
    offering: a control that gives the same refusal every time is worse
    than no control at all.
  */
  const [unconfigured, setUnconfigured] = useState(false);
  const [saving, setSaving] = useState(false);

  const availability = getAnalysisAvailability();
  const { session } = useAuth();
  const repository = useJournalRepository();

  /**
   * Send the photo for analysis.
   *
   * This is the step the app was written around and the one that was never
   * wired up: `analyzeMealPhoto` existed, the Edge Function was deployed,
   * and no screen called either. Until now the only routes out of a captured
   * photo were "write a recipe" and "type the foods in yourself".
   */
  const analyse = async () => {
    if (!photo) return;

    setAnalysing(true);
    setError(null);
    const result = await analyzeMealPhoto({
      imageUri: photo.uri,
      mimeType: photo.mimeType,
      localHour: new Date().getHours(),
      retainPhoto: retainPhotos,
      accessToken: session?.access_token ?? null,
      fallbackMealType: mealTypeForHour(new Date().getHours()),
    });
    setAnalysing(false);

    if (!result.ok) {
      setError(result.error);
      if (result.error.code === 'not_configured') setUnconfigured(true);
      return;
    }
    setAnalysis(result.value);
  };

  /** Write the analysed items to today, as shown. */
  const saveAnalysis = async () => {
    if (!analysis) return;

    setSaving(true);
    setError(null);
    const saved = await repository.createEntry({
      mealType: analysis.suggestedMealType,
      title: analysis.suggestedTitle,
      items: analysisToEntryItems(analysis),
      photoPath: analysis.photoPath,
    });
    setSaving(false);

    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    if (photo) discardPreparedImage(photo.uri);
    router.replace('/(tabs)');
  };

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

  /**
   * A frame straight from the in-app camera.
   *
   * It takes the same path as a library photo - validated by type, resized
   * on the device - because the analysis step cannot tell them apart and
   * neither should this screen. Permission is asked for by the camera
   * itself, which is where the user can see what it is for.
   */
  const handleCaptured = useCallback(
    async (uri: string) => {
      setBusy(true);
      setError(null);
      const prepared = await prepareImageForUpload(uri);
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

  if (analysis && photo) {
    return (
      <Screen
        title="On your plate"
        edges={{ top: true }}
        contentStyle={{ gap: theme.spacing.xl }}
      >
        {error ? (
          <ErrorState
            message={error.message}
            detail={error.detail}
            onRetry={error.retryable ? () => void saveAnalysis() : undefined}
          />
        ) : null}

        <AnalysisResult
          analysis={analysis}
          items={analysisToEntryItems(analysis)}
          saving={saving}
          onSave={() => void saveAnalysis()}
          // The editor owns corrections; this screen only shows and saves.
          onEdit={() =>
            router.push({
              pathname: '/entry/new',
              params: { photoUri: photo.uri },
            })
          }
          onDiscard={() => {
            discardPreparedImage(photo.uri);
            setAnalysis(null);
            setPhoto(null);
          }}
        />

        {/*
          Saving for quick add is deliberately not offered yet: the meal is
          not in the journal until the button above is pressed, and a
          shortcut to something that does not exist reads as a bug.
        */}
        <MealActions
          title={analysis.suggestedTitle}
          mealType={analysis.suggestedMealType}
          items={analysisToEntryItems(analysis)}
        />
      </Screen>
    );
  }

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

        {/*
          The analysis can fail here, and without this nothing said so: the
          button spun for a moment and the screen went back to how it was,
          which reads as a dead button rather than as a server that is not
          set up.
        */}
        {error ? (
          <ErrorState
            message={error.message}
            detail={error.detail}
            onRetry={error.retryable ? () => void analyse() : undefined}
          />
        ) : null}

        {availability.available && !unconfigured ? (
          <Button
            label="Work out the nutrition"
            onPress={() => void analyse()}
            loading={analysing}
            size="lg"
            fullWidth
            haptic
            leading={
              <Icon name="sparkle" size={20} color={theme.colors.background} />
            }
          />
        ) : null}

        <Section
          title={availability.available && !unconfigured ? 'Or' : 'What next?'}
          dense
        >
          <Surface variant="grouped">
            <Row
              title="Make this at home"
              subtitle="Works out the dish from the photo and writes a recipe"
              leading={<Icon name="recipes" size={19} color="textMuted" />}
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
              onPress={() =>
                router.push({
                  pathname: '/entry/new',
                  params: { photoUri: photo.uri },
                })
              }
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

  /*
    The camera fills the screen. An earlier version put a square placeholder
    panel here with a "Take a photo" button that handed off to the operating
    system's camera app, which meant the app's central act happened outside
    the app, with no framing guides at the moment they matter.

    The notices sit over the preview rather than above it, so they never
    squeeze the frame.
  */
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <CameraCapture
        onCaptured={(uri) => void handleCaptured(uri)}
        onPickFromLibrary={() => void pickFromLibrary()}
        onClose={() => router.push('/(tabs)')}
        onAddByHand={() => router.push('/entry/new')}
        onScanBarcode={() => router.push('/label/scan')}
        busy={busy}
      />

      <View
        style={{
          position: 'absolute',
          top: insets.top + 64,
          left: theme.gutter,
          right: theme.gutter,
          gap: theme.spacing.md,
        }}
        pointerEvents="box-none"
      >
        <OfflineNotice message="Taking a photo works, but it cannot be analysed until you are back online." />

        {error ? (
          <ErrorState
            message={error.message}
            detail={error.detail}
            onRetry={error.retryable ? () => setError(null) : undefined}
            retryLabel="Dismiss"
          />
        ) : null}

        {!availability.available ? (
          <Disclosure
            summary="Nutrition analysis is not set up in this build"
            detail={`${availability.reason} Capturing, validating and compressing a photo all work now; only the analysis step needs a server.`}
            tone="caution"
          />
        ) : null}
      </View>
    </View>
  );
}
