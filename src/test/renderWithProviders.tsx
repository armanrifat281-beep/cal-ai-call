import { render } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth';
import { ThemeProvider } from '@/theme';

/**
 * Test helper: mounts a component inside the providers the app supplies.
 *
 * Safe-area metrics are fixed so layout does not depend on a real device, and
 * `render` is awaited because React Native Testing Library 14 is async.
 *
 * AuthProvider is included and, with no Supabase configured in tests, settles
 * on the `unavailable` status - which is exactly the device-only mode the
 * screens are asserted against.
 */
const TEST_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={TEST_METRICS}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export function renderWithProviders(ui: React.ReactElement) {
  // Passed as `wrapper` rather than wrapped inline, so `rerender` keeps the
  // providers instead of replacing the whole tree with a bare element.
  return render(ui, { wrapper: Providers });
}
