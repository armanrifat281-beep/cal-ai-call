import { Redirect } from 'expo-router';

import { usePreferencesStore } from '@/store/preferencesStore';

/**
 * Boot gate.
 *
 * Decides the first screen from stored state. The root layout already waited
 * for that state to load, so this never renders a loading view.
 */
export default function BootGate() {
  const hasOnboarded = usePreferencesStore((state) => state.onboardingCompletedAt !== null);

  return <Redirect href={hasOnboarded ? '/(tabs)' : '/(onboarding)/welcome'} />;
}
