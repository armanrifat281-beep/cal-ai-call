import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** The food database screens, presented over whatever opened them. */
export default function FoodsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="search" options={{ title: 'Search a food' }} />
      <Stack.Screen name="portion" options={{ title: 'Add a food' }} />
    </Stack>
  );
}
