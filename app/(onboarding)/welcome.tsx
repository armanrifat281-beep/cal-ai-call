import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, InfoNote, Screen, Text } from '@/components/ui';
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
    title: 'Build a food memory',
    body: 'The app learns the meals you log so re-logging them takes one tap.',
  },
];

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Screen
      edges={{ top: true, bottom: true }}
      footer={
        <>
          <Button
            label="Set up FoodLens"
            onPress={() => router.push('/(onboarding)/basics')}
            size="lg"
            fullWidth
            haptic
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
      <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xl }}>
        <Text variant="label" color="primaryOnSoft">
          FOODLENS AI
        </Text>
        <Text variant="display">Understand what is on your plate.</Text>
        <Text variant="body" color="textMuted">
          A food journal that reads your photos, shows its working, and tells you
          when it is not sure.
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
        {VALUE_POINTS.map((point, index) => (
          <Card key={point.title} variant="soft" padding="base">
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="label" color="textOnPrimary">
                  {index + 1}
                </Text>
              </View>
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <Text variant="headline">{point.title}</Text>
                <Text variant="callout" color="textMuted">
                  {point.body}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <InfoNote
        title="Estimates, not measurements"
        body="A photo cannot show hidden oil, sugar or exact weight. FoodLens gives an estimate, labels where every number came from, and lets you correct it. It is not medical advice."
        tone="warning"
        style={{ marginTop: theme.spacing.sm }}
      />
    </Screen>
  );
}
