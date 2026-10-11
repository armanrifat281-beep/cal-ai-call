import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth';
import { usePreferencesStore } from '@/store/preferencesStore';
import { ThemeProvider, useTheme, useThemeContext } from '@/theme';

// Hold the native splash screen until we know whether the user has onboarded,
// so the first frame is the right screen rather than a flash of the wrong one.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unavailable in this environment. Not fatal.
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const theme = useTheme();
  const themeReady = useThemeContext().isReady;
  const preferencesHydrated = usePreferencesStore((state) => state.hydrated);
  // Auth too, now that the first screen depends on it: without this the
  // gate would send an already signed-in user to sign in and then correct
  // itself a frame later.
  const authSettled = useAuth().status !== 'loading';

  const ready = themeReady && preferencesHydrated && authSettled;

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync().catch(() => {
      // Nothing to hide. Safe to ignore.
    });
  }, [ready]);

  // Render nothing while the splash screen is still up: mounting routes before
  // the stored state is known would redirect twice and flicker.
  if (!ready) return null;

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <PasswordResetGate />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

/**
 * Sends the user to choose a password after a reset link.
 *
 * The callback screen already does this for the usual case, where the link
 * cold-starts the app. This covers the other one: the app is open, Supabase
 * reports the recovery on its own channel, and nobody is watching the
 * callback route. Without it the user ends up holding a valid session and a
 * password they do not know, with nothing on screen about it.
 */
function PasswordResetGate() {
  const { passwordResetPending } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const onResetScreen = pathname === '/reset-password';

  useEffect(() => {
    if (!passwordResetPending || onResetScreen) return;
    router.replace('/(auth)/reset-password');
  }, [passwordResetPending, onResetScreen, router]);

  return null;
}
