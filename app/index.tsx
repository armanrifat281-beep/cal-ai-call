import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth';
import { usePreferencesStore } from '@/store/preferencesStore';

/**
 * Boot gate.
 *
 * Signed out: the welcome screen, which says what the app is before asking
 * for an email address. It offers both doors, so arriving with an account
 * still costs one tap. An earlier version redirected straight to the
 * sign-in form, which put a credential prompt in front of anyone who had
 * not yet been told what they would be signing into.
 *
 * Signed in: onboarding if it has not been done, so the questions are asked
 * of someone whose answers have somewhere to be saved, and the app itself
 * after that. Onboarding opens on a screen that says what the app does
 * before asking anything - not a second "Get started", which is what used to
 * be there, but the one sentence that explains why it is about to ask how
 * tall you are. It carries a way past itself, so nobody is held at it.
 *
 * There is no backend-missing shortcut here. An earlier version skipped
 * straight to onboarding when no Supabase project was configured, on the
 * reasoning that there was nothing to sign into - which meant that in the
 * build anyone actually runs, the login screen never appeared at all. The
 * screens themselves handle that case now, where it is visible.
 */
export default function BootGate() {
  const { isSignedIn } = useAuth();
  const hasOnboarded = usePreferencesStore(
    (state) => state.onboardingCompletedAt !== null,
  );

  if (!isSignedIn) return <Redirect href="/(auth)/welcome" />;

  return <Redirect href={hasOnboarded ? '/(tabs)' : '/(onboarding)/intro'} />;
}
