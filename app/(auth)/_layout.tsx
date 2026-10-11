import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/**
 * The auth stack.
 *
 * No navigation header on any of these. Sign-in is the app's entry screen
 * now, so a bar above it has nothing to go back to, and every screen here
 * already opens with its own heading - a header would have printed "Sign
 * in" directly above "Welcome back".
 *
 * Each screen carries its own way out instead, which is checked: sign-up
 * offers "I already have an account", reset offers "Back to sign in", the
 * new-password screen offers "Not now", and the email callback redirects on
 * its own.
 */
export default function AuthLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
