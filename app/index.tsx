import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth';
import { usePreferencesStore } from '@/store/preferencesStore';

/**
 * Boot gate.
 *
 * Signing in comes first. The app is an account you carry between devices
 * now, so the first screen is sign-in rather than a setup questionnaire
 * that leaves the account until later.
 *
 * With one exception, and it is not a preference. When no Supabase project
 * is configured there is nothing to sign into: requiring it would leave no
 * way into the app at all, in the exact build a developer opens first. So
 * the gate stands aside and the auth screens explain why. Add credentials
 * and the gate starts enforcing on its own, with no code change.
 *
 * The root layout holds the splash screen until auth has settled, so this
 * never renders a redirect it is about to change its mind about.
 */
export default function BootGate() {
  const { status, isSignedIn } = useAuth();
  const hasOnboarded = usePreferencesStore(
    (state) => state.onboardingCompletedAt !== null,
  );

  const intoApp = hasOnboarded ? '/(tabs)' : '/(onboarding)/welcome';

  if (status === 'unavailable') return <Redirect href={intoApp} />;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return <Redirect href={intoApp} />;
}
