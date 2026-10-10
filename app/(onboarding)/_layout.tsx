import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        // Forward motion matches the sense of progressing through steps.
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    />
  );
}
