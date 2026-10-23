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
      {/*
        No header on the recipe itself. Its subject is a photograph bled to
        the edges with back, favourite and overflow floating on it, so a bar
        above that would be a strip of furniture between the user and the
        dish - and, since the recipe screens are drawn in the light scheme,
        a bar in the dark one directly above a pale page.
      */}
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      {/*
        Cooking mode hides the header: the screen is read at arm's length
        while cooking, and every pixel of height helps.
      */}
      <Stack.Screen name="cook/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
