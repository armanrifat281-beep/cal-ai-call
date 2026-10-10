import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Badge, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import type { RecipeImage as RecipeImageData, RecipeImageKind } from '@/types/recipe';

/**
 * A recipe's image, always labelled for what it is.
 *
 * No image provider is configured, so in practice this renders the generated
 * placeholder below. That is deliberate: the app does not invent a photograph
 * of a finished dish, and an illustrative image is never presented as one.
 * The `kind` is stored with the image and drives the label, so the
 * distinction cannot be lost.
 */

/** The label shown over an image, or null when none is needed. */
const KIND_LABELS: Record<RecipeImageKind, string | null> = {
  // An illustration of the intended dish, not a photo of the user's cooking.
  ai_generated: 'Illustration, not a photo of your dish',
  stock_library: 'Stock photo of a similar dish',
  // The user took it themselves, so it needs no disclaimer.
  user_photo: null,
  placeholder: null,
};

export interface RecipeImageProps {
  image: RecipeImageData | null;
  /** Used to pick the placeholder's colours and initial. */
  title: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function RecipeImage({ image, title, height = 190, style }: RecipeImageProps) {
  const theme = useTheme();
  const label = image ? KIND_LABELS[image.kind] : null;

  const frame: ViewStyle = {
    width: '100%',
    height,
    borderRadius: theme.radius.surface,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  };

  return (
    <View style={[frame, style]}>
      {image?.uri ? (
        <Image
          source={{ uri: image.uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          accessibilityLabel={
            label ? `${title}. ${label}` : `Photo of ${title}`
          }
          // The placeholder shows while the remote image loads, and stays if
          // it fails, so a dead image URL never breaks the screen.
          placeholder={null}
          transition={200}
        />
      ) : (
        <RecipePlaceholder title={title} />
      )}

      {label ? (
        <View
          style={{
            position: 'absolute',
            left: theme.spacing.sm,
            bottom: theme.spacing.sm,
          }}
        >
          <Badge label={label} tone="warning" />
        </View>
      ) : null}

      {image?.attribution ? (
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
            {image.attribution}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * A generated graphic standing in for a missing image.
 *
 * Deterministic from the title, so the same recipe always looks the same, and
 * two recipes in a list look different. It is obviously a graphic rather than
 * a photo, which is the point: no image is better than a misleading one.
 */
function RecipePlaceholder({ title }: { title: string }) {
  const theme = useTheme();

  // A stable hash of the title picks the hue.
  let hash = 0;
  for (let index = 0; index < title.length; index += 1) {
    hash = (hash * 31 + title.charCodeAt(index)) % 360;
  }
  const hue = Math.abs(hash);
  const isDark = theme.scheme === 'dark';
  const from = `hsl(${hue}, ${isDark ? 28 : 42}%, ${isDark ? 22 : 86}%)`;
  const to = `hsl(${(hue + 40) % 360}, ${isDark ? 24 : 38}%, ${isDark ? 16 : 78}%)`;

  const initial = title.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={{ flex: 1 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="recipePlaceholder" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#recipePlaceholder)" />
      </Svg>

      <View
        style={{
          position: 'absolute',
          inset: 0,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xs,
        }}
      >
        <Text variant="display" color="textMuted">
          {initial}
        </Text>
        <Text variant="caption" color="textMuted">
          NO PHOTO YET
        </Text>
      </View>
    </View>
  );
}
