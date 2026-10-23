import { Image, View } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface AvatarProps {
  /** The display name to take initials from. Null falls back to a glyph. */
  name: string | null;
  /** The user's picture. Null shows their initials instead. */
  imageUri?: string | null;
  size?: number;
  onPress?: () => void;
}

/**
 * The user, top right.
 *
 * A picture when the user has set one, their initials when they have not.
 * Initials are the default rather than an empty silhouette, so the circle
 * says something about them from the first launch. Either way the circle's
 * real job is being the door to Profile - the one place sign-out, targets
 * and privacy live.
 *
 * Drawn in the accent so it reads as "you" rather than as another grey
 * control, and it is the only round thing on the header row.
 */
export function Avatar({ name, imageUri, size = 42, onPress }: AvatarProps) {
  const theme = useTheme();
  const initials = initialsFor(name);

  const circle = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: theme.colors.primarySoft,
        borderWidth: theme.hairline,
        borderColor: theme.colors.primary,
      }}
    >
      {imageUri ? (
        <Image
          testID="avatar-image"
          source={{ uri: imageUri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text
          variant="headline"
          color="primary"
          style={{ fontSize: Math.round(size * 0.38), fontWeight: '700' }}
        >
          {initials}
        </Text>
      )}
    </View>
  );

  if (!onPress) return circle;

  return (
    <PressableScale
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityLabel={name ? `${name}. Open your profile` : 'Open your profile'}
      scaleTo={0.92}
    >
      {circle}
    </PressableScale>
  );
}

/**
 * Up to two initials from a name.
 *
 * First and last word rather than the first two, so "Nasim Ahmed Rahman"
 * gives NR as people write it themselves. A name with nothing usable in it
 * falls back to a person glyph rather than to an empty circle.
 */
export function initialsFor(name: string | null): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) return '·';
  if (words.length === 1) return words[0]!.slice(0, 1).toUpperCase();

  const first = words[0]!.slice(0, 1);
  const last = words[words.length - 1]!.slice(0, 1);
  return `${first}${last}`.toUpperCase();
}
