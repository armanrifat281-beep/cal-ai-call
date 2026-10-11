import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth';
import { usePreferencesStore } from '@/store/preferencesStore';

/**
 * Boot gate.
 *
 * Sign-in is the first screen. Always. Onboarding comes after it, so the
 * questions are asked of someone whose answers have somewhere to be saved.
 *
 * There is no backend-missing shortcut here. An earlier version skipped
 * straight to onboarding when no Supabase project was configured, on the
 * reasoning that there was nothing to sign into - which meant that in the
 * build anyone actually runs, the login screen never appeared at all. The
 * screen itself handles that case now, where it is visible.
 */
export default function BootGate() {
  const { isSignedIn } = useAuth();
  const hasOnboarded = usePreferencesStore(
    (state) => state.onboardingCompletedAt !== null,
  );

  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return <Redirect href={hasOnboarded ? '/(tabs)' : '/(onboarding)/welcome'} />;
}
