import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Disclosure, Screen, Stepper, Text } from '@/components/ui';
import { useJournalRepository } from '@/features/journal';
import { mealTypeForHour } from '@/features/journal/MealEditor';
import { saveDishPhoto } from '@/features/photos';
import { prepareImageForUpload } from '@/features/scanner/image';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';
import type { Recipe } from '@/types/recipe';

import { MAX_SERVINGS } from './scaling';
import { recipeToJournalItem } from './toJournalEntry';

export interface CookedScreenProps {
  /** The recipe just cooked, for the photo and for logging it. */
  recipe: Recipe;
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
export function CookedScreen({ recipe, onDone }: CookedScreenProps) {
  const theme = useTheme();
  const journal = useJournalRepository();

  const recipeId = recipe.id;
  const recipeTitle = recipe.title;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const [servingsEaten, setServingsEaten] = useState(1);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [logError, setLogError] = useState<AppError | null>(null);

  const canLog = recipe.nutritionPerServing !== null;

  const logToJournal = async () => {
    const item = recipeToJournalItem({ recipe, servingsEaten });
    if (!item) return;

    setLogging(true);
    setLogError(null);

    const result = await journal.createEntry({
      consumedAt: new Date().toISOString(),
      mealType: mealTypeForHour(new Date().getHours()),
      title: recipeTitle,
      items: [item],
      notes: null,
    });

    setLogging(false);
    if (!result.ok) {
      setLogError(result.error);
      return;
    }
    setLogged(true);
  };

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

      {/*
        The recipe already knows what a serving contains. Until now the user
        had to retype those figures into the journal by hand.
      */}
      {canLog ? (
        <View style={{ gap: theme.spacing.md }}>
          {logged ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Icon name="check" size={16} color="success" />
              <Text variant="footnote" color="textMuted">
                Added to today’s journal.
              </Text>
            </View>
          ) : (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                }}
              >
                <Text variant="headline" style={{ flex: 1 }}>
                  How much did you eat?
                </Text>
                <Stepper
                  value={servingsEaten}
                  onChange={setServingsEaten}
                  min={1}
                  max={MAX_SERVINGS}
                  label="Servings eaten"
                />
              </View>

              {logError ? (
                <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
                  {logError.message}
                </Text>
              ) : null}

              <Button
                label="Add to today’s journal"
                variant="secondary"
                onPress={() => void logToJournal()}
                loading={logging}
                fullWidth
              />
              <Text variant="caption" color="textSubtle">
                Logged with the recipe’s own estimate, labelled as one.
              </Text>
            </>
          )}
        </View>
      ) : (
        <Disclosure
          summary="This recipe has no nutrition estimate to log"
          detail="Nothing was written for it, and a made-up figure in your journal is worse than a gap. You can still add the meal by hand from the Journal tab."
        />
      )}

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
              leading={<Icon name="camera" size={18} color={theme.colors.textOnPrimary} />}
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
