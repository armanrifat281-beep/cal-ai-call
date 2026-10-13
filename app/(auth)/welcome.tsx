import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { PressableScale, Text } from '@/components/ui';

/**
 * The first screen anyone sees.
 *
 * Deliberately outside the theme. Every other screen follows the app's
 * cream-and-forest system and the user's light/dark choice; this one is
 * always black, because it is the only screen with a photograph as its
 * subject and a photograph needs a dark room. Hard-coded values rather than
 * theme tokens are the honest way to say that: a token that means "black
 * even in light mode" would be a lie to every other screen that reads it.
 *
 * The photograph is bled off the top of the screen and faded into the page
 * rather than framed in a card. A card would make it decoration sitting on
 * the layout; this way the black of the room and the black of the interface
 * are the same black, and the food is simply what the top of the screen is.
 */
const INK = '#0A0A0A';
const CHARCOAL = '#171717';
const WHITE = '#FFFFFF';
const MUTED = '#A3A3A3';
const LIME = '#A3E635';

/**
 * How much of the screen the photograph takes, before the fade.
 *
 * Half. Taller than this and the headline climbs onto the plate, which
 * reads as text dropped on a picture rather than as a layout.
 */
const IMAGE_RATIO = 0.5;

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const imageHeight = Math.round(height * IMAGE_RATIO);

  return (
    <View style={{ flex: 1, backgroundColor: INK }}>
      <View style={{ height: imageHeight, width: '100%' }}>
        <Image
          source={require('../../assets/welcome-meal.jpg')}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          // Held in memory and on disk: this is the first thing drawn on a
          // cold start, and a blank rectangle while it decodes is the worst
          // possible first frame.
          cachePolicy="memory-disk"
          transition={240}
          accessibilityLabel="A plated salmon dish photographed on a dark table"
        />

        {/*
          The fade begins below the dish, not across it.

          An earlier version started at 35% and had the food sitting in the
          ramp, so the one thing the screen is about was the dimmest thing on
          it. It now stays clear through the plate and only closes over the
          last fifth, which is table rather than food - and still reaches the
          page's exact black, so there is no seam where the image ends.
        */}
        <LinearGradient
          colors={['transparent', 'rgba(10,10,10,0.45)', INK]}
          locations={[0.74, 0.91, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
          pointerEvents="none"
        />

        <View
          style={{
            position: 'absolute',
            top: insets.top + 20,
            left: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <BrandMark size={30} />
          <Text
            variant="headline"
            color={WHITE}
            style={{ letterSpacing: -0.3, fontWeight: '700' }}
          >
            FoodLens AI
          </Text>
        </View>
      </View>

      {/*
        Pulled up just far enough to sit inside the fade, so the text begins
        in the photograph's shadow rather than below a hard edge - and not so
        far that it climbs onto the plate.
      */}
      <View
        style={{
          flex: 1,
          marginTop: -18,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ gap: 14 }}>
          <Text
            variant="display"
            color={WHITE}
            style={{ fontSize: 40, lineHeight: 44, letterSpacing: -1.4 }}
          >
            {'Know what\nyou eat.'}
          </Text>

          <Text
            variant="body"
            color={MUTED}
            style={{ maxWidth: 320, lineHeight: 23 }}
          >
            Scan a meal to see its nutrition, discover recipes from what you
            already have, and plan the week — all in one place.
          </Text>

          {/*
            The claim the app can actually keep, and the one nothing else
            makes: it says which figures were measured and which were
            guessed. A single line, in the accent, so it reads as the point
            rather than as a feature list.
          */}
          <View
            style={{
              marginTop: 6,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: CHARCOAL,
              gap: 6,
            }}
          >
            <Text
              variant="label"
              color={LIME}
              style={{ letterSpacing: 0.8 }}
            >
              MEASURED, OR ESTIMATED
            </Text>
            <Text variant="footnote" color={MUTED} style={{ maxWidth: 320 }}>
              Every figure says where it came from, so you know how much of
              the day is actually known.
            </Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <PressableScale
            onPress={() => router.push('/(auth)/sign-up')}
            haptic
            accessibilityRole="button"
            accessibilityLabel="Get started"
            style={{
              backgroundColor: LIME,
              borderRadius: 999,
              paddingVertical: 18,
              alignItems: 'center',
            }}
          >
            {/* Near-black on lime: white on this green fails contrast. */}
            <Text variant="headline" color={INK} style={{ fontWeight: '700' }}>
              Get started
            </Text>
          </PressableScale>

          {/*
            A quieter second door. Two filled buttons side by side is how a
            screen ends up with no answer to "what do I press".
          */}
          <PressableScale
            onPress={() => router.push('/(auth)/sign-in')}
            accessibilityRole="button"
            accessibilityLabel="Log in to an existing account"
            style={{
              backgroundColor: CHARCOAL,
              borderRadius: 999,
              paddingVertical: 18,
              alignItems: 'center',
            }}
          >
            <Text variant="headline" color={WHITE} style={{ fontWeight: '600' }}>
              Log in
            </Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}
