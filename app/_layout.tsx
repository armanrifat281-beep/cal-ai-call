import { Stack, usePathname, useRouter, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth';
import { refreshAvatar, restoreAvatar } from '@/features/profile';
import { usePreferencesStore } from '@/store/preferencesStore';
import { ThemeProvider, useTheme, useThemeContext } from '@/theme';

// Hold the native splash screen until we know whether the user has onboarded,
// so the first frame is the right screen rather than a flash of the wrong one.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unavailable in this environment. Not fatal.
});

/**
 * What the app shows instead of disappearing.
 *
 * Expo Router renders this in place of the tree when a screen throws. Without
 * it a render error unmounts everything, which on a phone looks exactly like
 * the app closing itself - and leaves no way to find out what happened,
 * because the message goes to a console nobody is reading.
 *
 * Deliberately styled with literal values and plain React Native components:
 * it has to draw correctly even when the thing that threw IS the theme, the
 * font or a shared component.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#FAF9F6', padding: 24, paddingTop: 72 }}>
      <RNText style={{ fontSize: 24, fontWeight: '700', color: '#100F0E' }}>
        This screen ran into a problem
      </RNText>

      <RNText style={{ fontSize: 15, color: '#4B4844', marginTop: 10, lineHeight: 21 }}>
        Nothing you saved has been lost. Read the message below out to whoever
        is working on the app - it names the fault exactly.
      </RNText>

      <ScrollView
        style={{
          marginTop: 20,
          maxHeight: 280,
          backgroundColor: '#ECE9E3',
          borderRadius: 14,
          padding: 14,
        }}
      >
        <RNText selectable style={{ fontSize: 13, color: '#302E2B', lineHeight: 19 }}>
          {error.message}
        </RNText>
        {error.stack ? (
          <RNText
            selectable
            style={{ fontSize: 11, color: '#6C6862', marginTop: 12, lineHeight: 16 }}
          >
            {error.stack.split('\n').slice(0, 12).join('\n')}
          </RNText>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={retry}
        accessibilityRole="button"
        style={{
          marginTop: 24,
          backgroundColor: '#133F2F',
          borderRadius: 999,
          paddingVertical: 16,
          alignItems: 'center',
        }}
      >
        <RNText style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
          Try again
        </RNText>
      </Pressable>
    </View>
  );
}

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
  const { status } = useAuth();
  const authSettled = status !== 'loading';

  const ready = themeReady && preferencesHydrated && authSettled;

  /*
    Show whatever picture this device already holds, then - once signed in -
    fetch the stored one if there is nothing local. That second case is a
    reinstall or a new phone; `restoreAvatar` leaves an existing local file
    alone, so a picture chosen here is never replaced by an older copy.
  */
  useEffect(() => {
    refreshAvatar();
  }, []);

  useEffect(() => {
    if (status !== 'signed_in') return;
    void restoreAvatar();
  }, [status]);

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
