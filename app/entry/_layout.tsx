import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function EntryLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
        presentation: 'card',
      }}
    >
      <Stack.Screen name="new" options={{ title: 'Add a meal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Meal' }} />
    </Stack>
  );
}
