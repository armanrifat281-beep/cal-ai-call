import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function ShoppingLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Shopping lists' }} />
      <Stack.Screen name="[id]" options={{ title: 'Shopping list' }} />
    </Stack>
  );
}
