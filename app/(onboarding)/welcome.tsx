import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { Icon } from '@/components/Icon';
import { BrandGradient, Button, Disclosure, Text } from '@/components/ui';
import { ramps, useTheme } from '@/theme';

/** What the app does, in the user's terms, before asking for anything. */
const CLAIMS = [
  'Every estimate shows its source',
  'Correct anything the camera got wrong',
  'Your photos stay on your device',
];

/**
 * The first screen.
 *
 * It is the only screen in the app that exists purely to make a case, so it
 * is the one place where the type is allowed to be the whole design: one
 * statement at 46px, three things the app can actually keep, and a single
 * button.
 *
 * An earlier version set all of this as dark text on the page ground with a
 * numbered rail down the left. It read as a well-formatted document rather
 * than the start of something, which on a first screen is the whole battle.
 * The gradient does that work now, so the list could lose its numbers and
 * become three claims the eye takes in at once.
 *
 * There is deliberately no chart here. The dial is the app's signature, and
 * showing it would mean either inventing a day nobody ate or drawing an
 * empty ring as decoration.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const onLight = ramps.neutral[25];

  return (
    <BrandGradient style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + theme.spacing.xxl,
          paddingBottom: insets.bottom + theme.spacing.lg,
          paddingHorizontal: theme.gutter + 8,
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <BrandMark size={56} />
          <Text
            variant="footnote"
            color="rgba(247,247,248,0.7)"
            style={{ fontWeight: '600' }}
            onPress={() => router.push('/(onboarding)/privacy')}
            accessibilityRole="button"
            accessibilityLabel="Skip"
            accessibilityHint="Skips the questions and goes straight to the app"
          >
            Skip
          </Text>
        </View>

        <View style={{ flexGrow: 1 }} />

        <View style={{ gap: theme.spacing.base }}>
          <Text
            variant="display"
            color={onLight}
            style={{ fontSize: 46, lineHeight: 48, letterSpacing: -2 }}
          >
            {'Eat with\nyour eyes\nopen.'}
          </Text>
          <Text
            variant="body"
            color="rgba(247,247,248,0.64)"
            style={{ maxWidth: 292 }}
          >
            Photograph what is on your plate. FoodLens estimates the nutrition
            and shows you where every number came from.
          </Text>
        </View>

        <View style={{ height: theme.spacing.xxxl }} />

        <View style={{ gap: theme.spacing.base }}>
          {CLAIMS.map((claim) => (
            <View
              key={claim}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: 'rgba(107,171,144,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="check" size={13} color={ramps.forest[200]} strokeWidth={3} />
              </View>
              <Text variant="footnote" color="rgba(247,247,248,0.86)">
                {claim}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: theme.spacing.xl }} />

        <Disclosure
          summary="Estimates, not measurements"
          detail="A photo cannot show hidden oil, sugar or exact weight. FoodLens gives an estimate, labels where every number came from, and lets you correct it. It is not medical advice."
          tone="caution"
        />

        <View style={{ height: theme.spacing.xl }} />

        <Button
          label="Get started"
          onPress={() => router.push('/(onboarding)/basics')}
          size="lg"
          fullWidth
          haptic
        />
      </View>
    </BrandGradient>
  );
}
