import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth';
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

  const ready = themeReady && preferencesHydrated;

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
