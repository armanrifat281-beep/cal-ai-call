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
      {/* Draws its own header row, like the record does. */}
      <Stack.Screen name="describe" options={{ headerShown: false }} />
      <Stack.Screen name="edit" options={{ title: 'Edit meal' }} />
      {/*
        The record draws its own header row - a close button, the title and
        the time - so a navigator bar above it would print "Meal" directly
        over "Meal record".
      */}
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
