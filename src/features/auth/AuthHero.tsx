import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Text } from '@/components/ui';
import { ramps, useTheme } from '@/theme';

export interface AuthHeroProps {
  /** Two or three words per line; the line breaks are the caller's. */
  title: string;
  /** One sentence. Omitted on the shorter screens. */
  subtitle?: string;
  /** How tall the hero runs. The form card sits directly below it. */
  height?: number;
  /** Shown above the title, e.g. a back button. */
  leading?: React.ReactNode;
  /**
   * A photograph behind the title, as on the welcome screen.
   *
   * Opt-in rather than the default: it belongs where a screen is an
   * invitation - the welcome screen, and creating an account - and not on
   * sign-in, where someone has already decided and wants the field.
   */
  photo?: React.ComponentProps<typeof Image>['source'];
  /** What the photograph shows, for a screen reader. */
  photoLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The top of an auth screen.
 *
 * On the app's own paper, in the app's own type. It was a full-bleed forest
 * gradient with a card overlapping it, which had two faults: the screen did
 * not match the cream app waiting behind it, so creating an account looked
 * like a different product from using one, and a 356px wash of colour above
 * four fields made the decoration the loudest thing on a page whose job is
 * to be typed into.
 *
 * What it keeps is the reason the gradient existed: a plain mark over plain
 * fields gives the eye nowhere to start. The title still carries the screen,
 * at display size against the page, with a hairline rule under it instead of
 * a colour change to mark where the form begins.
 */
const DEFAULT_HEIGHT = 196;

/**
 * A photograph's share of the screen, and its bounds.
 *
 * A proportion rather than a fixed height: a fixed one left the last line of
 * the sign-up form hanging off the bottom of a 740pt phone while looking
 * comfortable on an 812. The clamps stop it collapsing on a very short
 * screen or swallowing a tall one.
 */
const PHOTO_SHARE = 0.36;
const PHOTO_MIN = 232;
const PHOTO_MAX = 310;

export function AuthHero({
  title,
  subtitle,
  height,
  leading,
  photo,
  photoLabel,
  style,
}: AuthHeroProps) {
  const theme = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const hasPhoto = photo !== undefined;

  const photoHeight = Math.round(
    Math.min(PHOTO_MAX, Math.max(PHOTO_MIN, screenHeight * PHOTO_SHARE)),
  );
  const minHeight = height ?? (hasPhoto ? photoHeight : DEFAULT_HEIGHT);

  return (
    <View
      style={[
        {
          minHeight,
          /*
            With a photograph the mark goes to the top and the title to the
            bottom, as on the welcome screen. Stacked at the bottom together,
            the mark landed on the brightest part of the plate and
            disappeared.
          */
          justifyContent: hasPhoto ? 'space-between' : 'flex-end',
          paddingHorizontal: theme.gutter + 4,
          paddingTop: theme.spacing.xl,
          // Clearance for the form card, which is lifted over this edge.
          paddingBottom: hasPhoto ? theme.spacing.xxl + 12 : theme.spacing.lg,
          gap: theme.spacing.lg,
          backgroundColor: theme.colors.background,
        },
        style,
      ]}
    >
      {hasPhoto ? (
        <>
          <Image
            source={photo}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            // Biased down the frame: centred, this crop lands on the blurred
            // room above the plate, so the photograph read as a dark smudge.
            contentPosition="bottom"
            cachePolicy="memory-disk"
            transition={240}
            accessibilityLabel={photoLabel}
          />

          {/*
            A dark scrim, not a blend into the page.

            Fading to `theme.colors.background` looked right in dark mode and
            was unreadable in light: the title is white over the photograph,
            and the bottom of the gradient - exactly where the title sits -
            turned cream. The scrim is theme-independent for that reason, and
            the form card's rounded top is what covers the seam instead.
          */}
          <LinearGradient
            colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.58)']}
            locations={[0.3, 1]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            pointerEvents="none"
          />
        </>
      ) : null}

      {leading ?? <BrandMark size={40} />}

      <View style={{ gap: theme.spacing.sm }}>
        <Text
          variant="display"
          /*
            White over the photograph whatever the theme: the image behind it
            is dark in both, so the page's own text colour would vanish in
            light mode.
          */
          color={hasPhoto ? ramps.neutral[25] : undefined}
          style={{ fontSize: 34, lineHeight: 38, letterSpacing: -1.1 }}
        >
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text
            variant="footnote"
            color={hasPhoto ? 'rgba(247,247,248,0.78)' : 'textMuted'}
            style={{ maxWidth: 312 }}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}
