import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Skeleton } from '@/components/ui/Skeleton';
import { renderWithProviders } from '@/test/renderWithProviders';

import { useMotion } from '../useMotion';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    // Spreading the named exports loses the default one, which is where
    // Animated.View comes from.
    default: actual.default,
    useReducedMotion: jest.fn(() => false),
  };
});

const mockedReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;

function Probe() {
  const motion = useMotion();
  return <Text>{`${motion.enabled}:${motion.duration(200)}`}</Text>;
}

beforeEach(() => {
  mockedReducedMotion.mockReturnValue(false);
});

describe('useMotion', () => {
  it('allows motion by default', async () => {
    await renderWithProviders(<Probe />);
    expect(screen.getByText('true:200')).toBeTruthy();
  });

  it('collapses durations to zero when the system asks for less motion', async () => {
    mockedReducedMotion.mockReturnValue(true);
    await renderWithProviders(<Probe />);
    // Zero, not skipped: the view still reaches its end state.
    expect(screen.getByText('false:0')).toBeTruthy();
  });
});

describe('Skeleton under reduced motion', () => {
  it('renders a placeholder whether or not it may animate', async () => {
    for (const reduced of [true, false]) {
      mockedReducedMotion.mockReturnValue(reduced);
      const view = await renderWithProviders(<Skeleton width={100} height={16} />);
      expect(view.toJSON()).toBeTruthy();
      view.unmount();
    }
  });
});
