import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { Button, Text } from '@/components/ui';
import { useTheme } from '@/theme';

/**
 * The first screen anyone sees.
 *
 * Drawn on the app's own paper, not on a full-bleed gradient. The gradient
 * version looked like a different product from the one behind it: a dark
 * green wash, then a cream app. A first screen that does not match the
 * second one reads as a splash screen someone forgot to remove.
 *
 * Editorial rather than decorative - a mark, a claim, the reason, and the
 * two doors - because there is no photograph here that would be honest. A
 * stock plate of food implies the app's own analysis, and nothing has been
 * analysed yet.
 *
 * Deliberately no feature tour and no carousel: three screens of promises
 * before the app has done anything are three screens between someone and
 * their first photograph.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingHorizontal: theme.gutter + 4,
        paddingTop: insets.top + theme.spacing.xl,
        paddingBottom: insets.bottom + theme.spacing.xl,
      }}
    >
      <BrandMark size={44} />

      {/* The claim sits in the middle of the page, not crushed against the
          buttons: it is the reason to press one of them. */}
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
        <Text
          variant="display"
          style={{ fontSize: 40, lineHeight: 44, letterSpacing: -1.4 }}
        >
          {'Know what\nyou ate.'}
        </Text>

        <Text variant="body" color="textMuted" style={{ maxWidth: 312 }}>
          Photograph a meal and FoodLens works out the nutrition.
        </Text>

        {/*
          The one claim worth making on a first screen, and the only one this
          app can keep that the others cannot: it says which numbers it
          measured and which it guessed. A rule rather than a card, so it
          reads as a line of the argument and not as a feature tile.
        */}
        <View
          style={{
            gap: theme.spacing.sm,
            paddingTop: theme.spacing.base,
            borderTopWidth: 1,
            borderTopColor: theme.colors.separator,
            maxWidth: 328,
          }}
        >
          <Text variant="label" color="primary">
            MEASURED, OR ESTIMATED
          </Text>
          <Text variant="footnote" color="textMuted">
            Every figure is labelled with where it came from — a food
            database, a photograph, or you — so you know how much of the day
            is actually known.
          </Text>
        </View>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Button
          label="Get started"
          onPress={() => router.push('/(auth)/sign-up')}
          size="lg"
          fullWidth
          haptic
        />

        {/*
          A quieter second door rather than a matching button. Two filled
          buttons side by side is how a screen ends up with no answer to
          "what do I press".
        */}
        <Button
          label="I already have an account"
          variant="secondary"
          onPress={() => router.push('/(auth)/sign-in')}
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );
}
