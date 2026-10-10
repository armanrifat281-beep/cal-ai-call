import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function RecipeLayout() {
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
      }}
    >
      <Stack.Screen name="create" options={{ title: 'Create a recipe' }} />
      <Stack.Screen name="saved" options={{ title: 'My recipes' }} />
      <Stack.Screen name="[id]" options={{ title: 'Recipe' }} />
      {/*
        Cooking mode hides the header: the screen is read at arm's length
        while cooking, and every pixel of height helps.
      */}
      <Stack.Screen name="cook/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
