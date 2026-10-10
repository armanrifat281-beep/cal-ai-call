import { Image } from 'expo-image';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Text } from '@/components/ui';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

export interface MealPhotoFieldProps {
  /** The photo to show, or null when the meal has none. */
  uri: string | null;
  /** Called with null when the user removes the photo. */
  onChange: (uri: string | null) => void;
}

/**
 * The meal's own photograph.
 *
 * The scanner already takes a real picture of real food, and until now the
 * app threw it away the moment the user chose to log the meal. This is where
 * it survives: the one piece of authentic food photography the app can
 * honestly show, because the user took it.
 *
 * Whether it is actually kept is the user's decision, made during onboarding
 * and changeable in Profile. With "Keep my meal photos" off, the promise is
 * that the journal holds "only the food names and numbers", so the photo is
 * shown here as a preview and discarded on save unless the user turns
 * keeping on - which they can do from this card, since this is the moment
 * the choice means something.
 */
export function MealPhotoField({ uri, onChange }: MealPhotoFieldProps) {
  const theme = useTheme();
  const retainPhotos = usePreferencesStore((state) => state.preferences.retainPhotos);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);

  if (!uri) return null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          width: '100%',
          aspectRatio: 4 / 3,
          borderRadius: theme.radius.media,
          overflow: 'hidden',
          backgroundColor: theme.colors.surfaceAlt,
        }}
      >
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
          accessibilityLabel="The photo you took of this meal"
        />

        {!retainPhotos ? (
          <View
            style={{
              position: 'absolute',
              left: theme.spacing.sm,
              bottom: theme.spacing.sm,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 3,
              borderRadius: theme.radius.xs,
              backgroundColor: theme.colors.scrim,
            }}
          >
            <Text variant="caption" color="#FFFFFF">
              Preview only
            </Text>
          </View>
        ) : null}
      </View>

      {retainPhotos ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}
          >
            <Icon name="check" size={15} color="success" />
            <Text variant="footnote" color="textMuted">
              Saved with this meal, on this device
            </Text>
          </View>
          <Button
            label="Remove"
            variant="ghost"
            size="sm"
            onPress={() => onChange(null)}
          />
        </View>
      ) : (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="footnote" color="textMuted">
            Your photo settings keep only the food names and numbers, so this
            picture will not be saved with the meal.
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              label="Keep my photos"
              variant="secondary"
              size="sm"
              onPress={() => setPreferences({ retainPhotos: true })}
            />
            <Button
              label="Discard"
              variant="ghost"
              size="sm"
              onPress={() => onChange(null)}
            />
          </View>
        </View>
      )}
    </View>
  );
}
