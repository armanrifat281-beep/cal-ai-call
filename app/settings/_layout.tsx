import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function SettingsLayout() {
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
      <Stack.Screen name="profile" options={{ title: 'Your profile' }} />
      <Stack.Screen name="privacy" options={{ title: 'Your data' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of use' }} />
      <Stack.Screen name="help" options={{ title: 'Help' }} />
      <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
    </Stack>
  );
}
