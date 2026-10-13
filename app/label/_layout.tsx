import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** Packaged-food screens, presented over whatever opened them. */
export default function LabelLayout() {
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
      {/* The camera owns the whole screen, so it carries no bar. */}
      <Stack.Screen name="scan" options={{ headerShown: false }} />
      <Stack.Screen name="[barcode]" options={{ title: 'Product' }} />
    </Stack>
  );
}
