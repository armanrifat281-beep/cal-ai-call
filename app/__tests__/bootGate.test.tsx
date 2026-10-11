import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';
import { usePreferencesStore } from '@/store/preferencesStore';

import BootGate from '../index';

/**
 * Where the app opens.
 *
 * The mocked router renders a `redirect-<href>` view, so the destination is
 * assertable without a navigator.
 */
function destination(): string | undefined {
  const node = screen.toJSON();
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(walk);
    const element = value as { props?: Record<string, unknown>; children?: unknown };
    const testID = element.props?.testID;
    if (typeof testID === 'string' && testID.startsWith('redirect-')) {
      found.push(testID.replace('redirect-', ''));
    }
    if (element.children) walk(element.children);
  };
  walk(node);
  return found[0];
}

beforeEach(() => {
  usePreferencesStore.getState().reset();
});

describe('the boot gate with no backend configured', () => {
  it('lets the app open, because there is nothing to sign into', async () => {
    // Requiring sign-in here would leave no way into the app at all, in the
    // exact build a developer opens first.
    await renderWithProviders(<BootGate />);
    expect(destination()).toBe('/(onboarding)/welcome');
  });

  it('goes straight to the app once onboarding is done', async () => {
    usePreferencesStore.getState().completeOnboarding();
    await renderWithProviders(<BootGate />);
    expect(destination()).toBe('/(tabs)');
  });

  it('never sends anyone to a sign-in that cannot work', async () => {
    await renderWithProviders(<BootGate />);
    expect(destination()).not.toBe('/(auth)/sign-in');
  });
});
