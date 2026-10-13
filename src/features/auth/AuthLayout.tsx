import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Disclosure, ErrorState, OfflineNotice } from '@/components/ui';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';

import { AuthHero, type AuthHeroProps } from './AuthHero';
import { useAuth } from './AuthProvider';

export interface AuthLayoutProps {
  /** Set over the hero. Line breaks in it are deliberate. */
  title: string;
  /** One sentence under the title, over the hero. */
  subtitle?: string;
  /** The fields. */
  children: React.ReactNode;
  /** The buttons, at the end of the card. */
  footer: React.ReactNode;
  /** Shown above the fields when a request failed. */
  error?: AppError | null;
  onRetry?: () => void;
  /** A different way forward, for a failure that retrying cannot fix. */
  errorAction?: { label: string; onPress: () => void };
  /** What needs a connection, in a few words. */
  offlineMessage: string;
  /** Explains what cannot work yet when no backend is configured. */
  unavailableDetail: string;
  /** Replaces the brand mark at the top of the hero, e.g. a back button. */
  heroLeading?: React.ReactNode;
  /** A photograph behind the hero's title. See `AuthHero`. */
  heroPhoto?: AuthHeroProps['photo'];
  heroPhotoLabel?: string;
  /** How tall the hero runs. Shorter where the card holds more fields. */
  heroHeight?: number;
}

/**
 * The frame every auth screen shares.
 *
 * A hero, then a card that overlaps its lower edge. The overlap is the whole
 * point: two panels butted together read as two screens stacked, where a
 * card lifted onto the image reads as one surface with depth. It is also why
 * the card's radius is larger than the app's standard - at 18 the overlap
 * looks like a mistake.
 *
 * The form is always rendered, including when no backend is configured. An
 * earlier version replaced the whole screen with a notice in that case,
 * which was over-cautious to the point of being wrong: it meant the app had
 * no login page at all to look at, set up or hand to a designer, and the
 * brief was to build the integration-ready interface rather than hide it
 * until credentials arrive.
 *
 * Nothing pretends to work. The notice sits above the fields, before
 * anything is typed, and submitting returns the same plain "not configured"
 * the service already produces rather than a fake success.
 */
/*
  The form sits on the page, not on a panel lifted over a coloured hero.

  It was a raised, round-cornered card pulled 30px up over a forest
  gradient. With the hero on the app's own paper there is no colour change
  left for it to overlap, so a shadowed card would be a panel floating on an
  identical background - decoration marking a boundary the eye can already
  see from the hairline rule and the title above it.
*/
const CARD_RADIUS = 28;

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  error,
  onRetry,
  errorAction,
  offlineMessage,
  unavailableDetail,
  heroLeading,
  heroPhoto,
  heroPhotoLabel,
  heroHeight,
}: AuthLayoutProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { status } = useAuth();
  const unavailable = status === 'unavailable';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/*
          With a photograph the hero takes whatever the form does not.

          Fixed heights could not satisfy both a 740pt phone, where the form
          needed every point, and an 873pt one, where a fixed hero left a
          slab of empty card below the buttons. Letting the image absorb the
          slack means the form is always exactly as tall as it needs to be -
          which is what "the form takes up most of the screen" was really
          asking for.
        */}
        <AuthHero
          title={title}
          subtitle={subtitle}
          height={heroHeight}
          leading={heroLeading}
          photo={heroPhoto}
          photoLabel={heroPhotoLabel}
          style={heroPhoto === undefined ? undefined : { flexGrow: 1 }}
        />

        <View
          style={{
            // Hugs its content when there is a photograph above it, so the
            // image gets the rest. Without one it fills, as it always did.
            flexGrow: heroPhoto === undefined ? 1 : 0,
            flexShrink: 0,
            // Lifted over the photograph, so its rounded top is the edge of
            // the image rather than a line drawn near one.
            marginTop: heroPhoto === undefined ? 0 : -CARD_RADIUS,
            borderTopLeftRadius: CARD_RADIUS,
            borderTopRightRadius: CARD_RADIUS,
            borderTopWidth: 1,
            borderTopColor: theme.colors.separator,
            backgroundColor: theme.colors.surface,
            paddingHorizontal: theme.gutter + 4,
            /*
              Tighter than the rest of the app on purpose. These cards hold
              three or four fields and two buttons, and at the app's usual
              rhythm that ran past the bottom of a phone - which made signing
              up feel like a form to get through rather than two taps.
            */
            paddingTop: theme.spacing.base,
            paddingBottom: insets.bottom + theme.spacing.base,
            gap: theme.spacing.base,
          }}
        >
          {unavailable ? (
            <Disclosure
              summary="Accounts are not set up in this build"
              detail={unavailableDetail}
              tone="caution"
            />
          ) : null}

          <OfflineNotice message={offlineMessage} />

          {error ? (
            <ErrorState
              message={error.message}
              detail={error.detail}
              onRetry={onRetry}
              action={errorAction}
            />
          ) : null}

          <View style={{ gap: theme.spacing.md }}>{children}</View>

          {/*
            No spacer between the form and its buttons.

            There was one, pushing the buttons to the bottom of the card. Even
            capped it left about 56pt of nothing in the middle of the screen -
            its own height plus the card's gap on either side - which read as
            a hole rather than as spacing. The buttons now follow the fields,
            and whatever room is left falls below them, where it looks like
            margin.
          */}
          <View style={{ gap: theme.spacing.sm }}>{footer}</View>
        </View>
      </ScrollView>
    </View>
  );
}
