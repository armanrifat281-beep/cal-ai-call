import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Button, Disclosure, Screen, Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** What the app does, in the user's terms, before asking for anything. */
const VALUE_POINTS = [
  {
    title: 'Photograph a meal',
    body: 'Point your camera at your plate and get an estimate of what is in it.',
  },
  {
    title: 'Keep a food journal',
    body: 'Edit anything that looks wrong, then save the meal to your day.',
  },
  {
    title: 'Cook what you want',
    body: 'Name a dish or list what you have, and get a recipe you can follow.',
  },
];

/**
 * The first screen.
 *
 * One statement, three lines about what the app does, and the honest caveat.
 * It previously put each value point in its own outlined card, which made a
 * first impression of three identical boxes. Here the numbered rail carries
 * the structure and the mark carries the identity.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Screen
      edges={{ top: true, bottom: true }}
      contentStyle={{ gap: theme.spacing.xxl, justifyContent: 'center' }}
      footer={
        <>
          <Button
            label="Set up FoodLens"
            onPress={() => router.push('/(onboarding)/basics')}
            size="lg"
            fullWidth
          />
          <Button
            label="Look around first"
            variant="ghost"
            onPress={() => router.push('/(onboarding)/privacy')}
            fullWidth
            accessibilityHint="Skips the questions and goes straight to the app"
          />
        </>
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        <BrandMark size={52} />
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="display" style={{ fontSize: 36, lineHeight: 42 }}>
            Understand what is on your plate.
          </Text>
          <Text variant="body" color="textMuted">
            A food journal that reads your photos, shows its working, and tells
            you when it is not sure.
          </Text>
        </View>
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        {VALUE_POINTS.map((point, index) => (
          <View
            key={point.title}
            style={{ flexDirection: 'row', gap: theme.spacing.md }}
          >
            <Text variant="metricS" color="textSubtle" style={{ width: 16, paddingTop: 4 }}>
              {index + 1}
            </Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline">{point.title}</Text>
              <Text variant="footnote" color="textMuted">
                {point.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Disclosure
        summary="Estimates, not measurements"
        detail="A photo cannot show hidden oil, sugar or exact weight. FoodLens gives an estimate, labels where every number came from, and lets you correct it. It is not medical advice."
        tone="caution"
      />
    </Screen>
  );
}
