/**
 * Jest setup shared by every test file.
 *
 * Native modules that have no JS implementation under Node are mocked here so
 * pure-logic tests do not need a device.
 */

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  };
});

// expo-crypto is a native module with no JS implementation under Node. Node's
// own crypto.randomUUID is also a spec-compliant v4 UUID, so the mock matches
// what the device actually returns.
jest.mock('expo-crypto', () => {
  // Typed loosely on purpose: this project does not include @types/node, and
  // the mock only needs two functions from it.
  const nodeCrypto: {
    randomUUID: () => string;
    randomBytes: (size: number) => Uint8Array;
  } = require('crypto');
  return {
    randomUUID: () => nodeCrypto.randomUUID(),
    getRandomBytes: (length: number) => new Uint8Array(nodeCrypto.randomBytes(length)),
    getRandomBytesAsync: (length: number) =>
      Promise.resolve(new Uint8Array(nodeCrypto.randomBytes(length))),
  };
});

// The native date/time picker has no JS implementation under Node. The mock
// renders nothing and never fires, which is correct for tests that do not
// exercise date selection.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
}));

// expo-image renders a native view; a plain View keeps trees inspectable.
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});

// expo-router needs a real navigation context, which these tests do not have.
// The mock gives screens a router they can call and params they can read, so a
// render test still exercises the component's own logic and effects.
jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');

  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    dismiss: jest.fn(),
    setParams: jest.fn(),
  };

  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);

  return {
    __esModule: true,
    router,
    useRouter: () => router,
    useLocalSearchParams: () => ({}),
    useSegments: () => [],
    usePathname: () => '/',
    useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn() }),
    useFocusEffect: (callback: () => void) => React.useEffect(callback, []),
    Redirect: ({ href }: { href: string }) =>
      React.createElement(View, { testID: `redirect-${String(href)}` }),
    Link: Passthrough,
    Stack: Object.assign(Passthrough, { Screen: () => null }),
    Tabs: Object.assign(Passthrough, { Screen: () => null }),
    SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
  };
});
