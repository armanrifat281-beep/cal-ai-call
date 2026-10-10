import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function AuthLayout() {
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
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create an account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen
        name="reset-password"
        options={{ title: 'New password', headerBackVisible: false }}
      />
      {/*
        Where the confirmation and reset emails land. It only exchanges the
        code and redirects, so a header would flash and disappear.
      */}
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
    </Stack>
  );
}
