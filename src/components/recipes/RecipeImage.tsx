import { Image } from 'expo-image';
import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Text } from '@/components/ui';
import { dishPhotoUri } from '@/features/photos';
import { ramps, useTheme } from '@/theme';
import type { RecipeImage as RecipeImageData, RecipeImageKind } from '@/types/recipe';

/**
 * A recipe's image, always labelled for what it is.
 *
 * No image provider is configured, so there is no generated or stock image
 * to show. That is deliberate: the app does not invent a photograph of a
 * finished dish, and an illustrative image is never presented as one. The
 * `kind` is stored with the image and drives the label, so the distinction
 * cannot be lost.
 *
 * There is one real photograph it can show, and it beats anything a
 * provider would return: the one the user took of the dish after cooking
 * it. Pass `recipeId` and it is preferred over whatever is stored, because
 * their own plate is more use to them than an illustration of someone
 * else's. Failing that, the stand-in below.
 */

/** The label shown over an image, or null when none is needed. */
const KIND_LABELS: Record<RecipeImageKind, string | null> = {
  ai_generated: 'Illustration, not your dish',
  stock_library: 'Stock photo of a similar dish',
  // The user took it themselves, so it needs no disclaimer.
  user_photo: null,
  placeholder: null,
};

export interface RecipeImageProps {
  image: RecipeImageData | null;
  /** Used to pick the stand-in's tint. */
  title: string;
  /**
   * When given, a photo the user took of this dish is shown in preference
   * to `image`.
   */
  recipeId?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

function RecipeImageComponent({
  image,
  title,
  recipeId,
  height = 190,
  style,
}: RecipeImageProps) {
  const theme = useTheme();

  const ownPhoto = recipeId ? dishPhotoUri(recipeId) : null;
  const shown: RecipeImageData | null = ownPhoto
    ? { uri: ownPhoto, kind: 'user_photo', attribution: null }
    : image;
  const label = shown ? KIND_LABELS[shown.kind] : null;

  return (
    <View
      style={[
        {
          width: '100%',
          height,
          borderRadius: theme.radius.media,
          overflow: 'hidden',
          backgroundColor: theme.colors.surfaceAlt,
        },
        style,
      ]}
    >
      {shown?.uri ? (
        <Image
          source={{ uri: shown.uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          accessibilityLabel={label ? `${title}. ${label}` : `Photo of ${title}`}
          // The stand-in shows while a remote image loads and stays if it
          // fails, so a dead URL never leaves a blank hole in the layout.
          placeholder={null}
          transition={220}
          // Memory and disk caching, so a list of recipes does not refetch
          // the same thumbnails on every scroll.
          cachePolicy="memory-disk"
        />
      ) : (
        <RecipeStandIn title={title} height={height} />
      )}

      {label ? (
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
            {label}
          </Text>
        </View>
      ) : null}

      {shown?.attribution ? (
        <View
          style={{
            position: 'absolute',
            right: theme.spacing.sm,
            bottom: theme.spacing.sm,
            paddingHorizontal: theme.spacing.xs,
            paddingVertical: 2,
            borderRadius: theme.radius.xs,
            backgroundColor: theme.colors.scrim,
          }}
        >
          <Text variant="caption" color="#FFFFFF">
            {shown.attribution}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Flat tints, picked deterministically. No gradients. */
const LIGHT_TINTS = [
  ramps.clay[100],
  ramps.forest[50],
  ramps.ember[50],
  ramps.clay[50],
  ramps.forest[100],
];
const DARK_TINTS = ['#20241D', '#1B2A22', '#2A1E16', '#23211A', '#16241D'];

/**
 * The stand-in for a missing image.
 *
 * A flat tint from the palette with the brand mark set large and low-contrast
 * behind it. Earlier this was an `hsl()` gradient, which is exactly the
 * generated-app look it was meant to avoid - and a gradient also reads as
 * "decorative placeholder" rather than "this recipe has no photo".
 *
 * The tint is chosen from the title, so a recipe always looks the same and
 * two recipes in a list look different.
 */
function RecipeStandIn({ title, height }: { title: string; height: number }) {
  const theme = useTheme();

  // A stable hash of the title picks the tint.
  let hash = 0;
  for (let index = 0; index < title.length; index += 1) {
    hash = (hash * 31 + title.charCodeAt(index)) % 9973;
  }
  const tints = theme.scheme === 'dark' ? DARK_TINTS : LIGHT_TINTS;
  const tint = tints[Math.abs(hash) % tints.length] ?? tints[0];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ opacity: 0.22 }}>
        <BrandMark size={Math.max(28, Math.min(height * 0.5, 96))} />
      </View>
    </View>
  );
}

/**
 * Memoized: recipe thumbnails re-render on every parent state change
 * otherwise, and each one rasterizes an SVG.
 */
export const RecipeImage = memo(RecipeImageComponent);
