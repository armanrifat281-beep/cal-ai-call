import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { Button, BrandGradient, Text } from '@/components/ui';
import { ramps, useTheme } from '@/theme';

/**
 * The first screen anyone sees.
 *
 * Signed-out visitors used to land directly on the sign-in form, which asks
 * for an email address before saying what the app is or why anyone would
 * want an account. This says that first, in one sentence, and then offers
 * the two doors.
 *
 * Deliberately no feature tour and no carousel: three screens of promises
 * before the app has done anything are three screens between someone and
 * their first photograph. The claim here is the one the app can actually
 * keep - that it tells you where its numbers came from - and it is one line.
 *
 * Two actions, with one of them clearly first. Creating an account is the
 * path for almost everyone arriving here; signing in is for the few who have
 * been before, so it is quieter rather than equal.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <BrandGradient extent="full" style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.gutter + 8,
          paddingTop: insets.top + theme.spacing.huge,
          paddingBottom: insets.bottom + theme.spacing.xl,
        }}
      >
        <BrandMark size={56} />

        {/* The claim sits in the middle of the screen, not crushed against
            the buttons: it is the reason to press one of them. */}
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
          <Text
            variant="display"
            color={ramps.neutral[25]}
            style={{ fontSize: 44, lineHeight: 46, letterSpacing: -1.8 }}
          >
            {'Know what\nyou ate.'}
          </Text>

          <Text
            variant="body"
            // Not `textMuted`: that token is tuned for the page ground and
            // loses contrast over the gradient.
            color="rgba(247,247,248,0.72)"
            style={{ maxWidth: 300 }}
          >
            Photograph a meal and FoodLens works out the nutrition — and tells
            you which figures were measured and which were estimated, so you
            know how much to trust the total.
          </Text>
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
    </BrandGradient>
  );
}
