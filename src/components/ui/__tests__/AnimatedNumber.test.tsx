import { screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { renderWithProviders } from '@/test/renderWithProviders';

import { AnimatedNumber } from '../AnimatedNumber';
import { Appear, staggerDelay } from '../Appear';

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

beforeEach(() => {
  mockedReducedMotion.mockReturnValue(false);
});

describe('AnimatedNumber', () => {
  // The defect this component was rewritten to avoid: an earlier version
  // rounded a spring's progress, so the figure on screen came from the
  // animation. When the frame loop stalled it froze part-way, and an 1100
  // kcal day rendered as `2`.
  it('renders the real value, never a value sourced from the animation', async () => {
    await renderWithProviders(<AnimatedNumber value={1100} />);

    expect(screen.getByText('1100')).toBeTruthy();
  });

  it('shows the value with motion reduced too', async () => {
    mockedReducedMotion.mockReturnValue(true);
    await renderWithProviders(<AnimatedNumber value={1840} />);

    expect(screen.getByText('1840')).toBeTruthy();
  });

  it('honours decimals and the suffix', async () => {
    await renderWithProviders(<AnimatedNumber value={7.5} decimals={1} suffix="g" />);

    expect(screen.getByText('7.5g')).toBeTruthy();
  });

  it('pads to the asked precision rather than dropping a trailing zero', async () => {
    await renderWithProviders(<AnimatedNumber value={8} decimals={1} suffix="g" />);

    expect(screen.getByText('8.0g')).toBeTruthy();
  });

  it('keeps an explicit label for a figure that needs reading differently', async () => {
    await renderWithProviders(
      <AnimatedNumber value={1840} accessibilityLabel="1840 kilocalories" />,
    );

    expect(screen.getByLabelText('1840 kilocalories')).toBeTruthy();
  });

  it('shows a new value when it changes', async () => {
    const view = await renderWithProviders(<AnimatedNumber value={1100} />);
    await view.rerender(<AnimatedNumber value={1500} />);

    expect(screen.getByText('1500')).toBeTruthy();
  });
});

describe('Appear', () => {
  it('renders its children', async () => {
    await renderWithProviders(
      <Appear>
        <AnimatedNumber value={12} />
      </Appear>,
    );

    expect(screen.getByText('12')).toBeTruthy();
  });

  it('renders them with motion reduced too, rather than leaving them hidden', async () => {
    mockedReducedMotion.mockReturnValue(true);
    await renderWithProviders(
      <Appear index={3}>
        <AnimatedNumber value={12} />
      </Appear>,
    );

    expect(screen.getByText('12')).toBeTruthy();
  });

  describe('the cascade', () => {
    it('makes each sibling wait a little longer than the last', () => {
      expect(staggerDelay(0, 45)).toBe(0);
      expect(staggerDelay(1, 45)).toBe(45);
      expect(staggerDelay(3, 45)).toBe(135);
    });

    // Past a handful of items the cascade stops being a flourish and becomes
    // a wait, so the tail of a long list arrives together.
    it('stops growing once the cascade would become a delay', () => {
      expect(staggerDelay(6, 45)).toBe(270);
      expect(staggerDelay(7, 45)).toBe(270);
      expect(staggerDelay(200, 45)).toBe(270);
    });

    it('treats a negative position as the first one', () => {
      expect(staggerDelay(-3, 45)).toBe(0);
    });
  });
});
