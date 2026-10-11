import { screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { palettes } from '@/theme';
import { renderWithProviders } from '@/test/renderWithProviders';

import { Icon } from '@/components/Icon';

import { Button } from '../Button';

/**
 * Pins the button treatment from the supplied reference: a tall, fully
 * rounded pill with the rose-to-crimson gradient, white text and white
 * icons - on every variant, with none left out.
 *
 * These walk the rendered tree, so they catch the treatment being dropped
 * from a variant. They cannot tell you it LOOKS right on a device; that
 * still needs eyes.
 */

interface JsonNode {
  type?: string;
  props?: Record<string, unknown>;
  children?: unknown;
}

/** Depth-first search of the rendered tree. */
function findNode(predicate: (node: JsonNode) => boolean): JsonNode | null {
  const walk = (node: unknown): JsonNode | null => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const child of node) {
        const hit = walk(child);
        if (hit) return hit;
      }
      return null;
    }
    const current = node as JsonNode;
    if (predicate(current)) return current;
    return walk(current.children);
  };
  return walk(screen.toJSON());
}

/** expo-linear-gradient renders through this native view manager. */
const gradient = () =>
  findNode((node) => node.type === 'ViewManagerAdapter_ExpoLinearGradient');

/** Flattens a style prop, which may be an array. */
function flatStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map(flatStyle));
  }
  return (style as Record<string, unknown>) ?? {};
}

/** Everything that renders as a filled pill. `ghost` is the one level apart. */
const FILLED = ['primary', 'accent', 'tonal', 'secondary', 'danger'] as const;

describe('every button wears the reference treatment', () => {
  // One render per case: unmounting inside a loop detaches `screen`, so
  // every later assertion in the file sees an empty tree.
  it.each(FILLED)('gives %s the gradient', async (variant) => {
    await renderWithProviders(
      <Button label="Get All Access" variant={variant} onPress={jest.fn()} />,
    );
    expect(gradient()).not.toBeNull();
  });

  it.each(FILLED)('writes %s in white', async (variant) => {
    await renderWithProviders(
      <Button label="Get All Access" variant={variant} onPress={jest.fn()} />,
    );
    const style = flatStyle(screen.getByText('Get All Access').props.style);
    expect(style.color).toBe(palettes.light.textOnCta);
  });

  it('uses the reference colours, running top-left to bottom-right', async () => {
    await renderWithProviders(<Button label="Get All Access" onPress={jest.fn()} />);

    const props = gradient()?.props ?? {};
    // The native view manager receives colours already processed to ARGB
    // integers, so the expectation goes through the same conversion.
    expect(props.colors).toEqual(
      palettes.light.ctaGradient.map((stop) => processColor(stop)),
    );
    expect(props.startPoint).toEqual([0, 0]);
    expect(props.endPoint).toEqual([1, 1]);
  });

  it('leaves a ghost action as text, so two pills never stack', async () => {
    // Two filled pills in a footer compete, and the smaller one reads as a
    // second call to action rather than as the quiet way out.
    await renderWithProviders(
      <Button label="Skip for now" variant="ghost" onPress={jest.fn()} />,
    );
    expect(gradient()).toBeNull();
  });

  it('writes a ghost action in the same red, so it still belongs', async () => {
    await renderWithProviders(
      <Button label="Skip for now" variant="ghost" onPress={jest.fn()} />,
    );
    const style = flatStyle(screen.getByText('Skip for now').props.style);
    // The providers open in the app's default scheme, which is dark.
    expect(style.color).toBe(palettes.dark.primary);
  });

  it('keeps a ghost action tappable, with no fill to show for it', async () => {
    await renderWithProviders(
      <Button label="Skip" variant="ghost" size="sm" onPress={jest.fn()} />,
    );
    const shaped = findNode((node) => {
      const style = flatStyle(node.props?.style);
      return style.height === 44 && style.borderRadius === 22;
    });
    expect(shaped).not.toBeNull();
  });

  it('keeps the label bold and on one line', async () => {
    await renderWithProviders(<Button label="Get All Access" onPress={jest.fn()} />);
    const label = screen.getByText('Get All Access');
    expect(flatStyle(label.props.style).fontWeight).toBe('600');
    expect(label.props.numberOfLines).toBe(1);
  });
});

describe('the shape', () => {
  it.each([
    ['sm', 44],
    ['md', 54],
    ['lg', 62],
  ] as const)('is a true pill at %s: radius is half the height', async (size, height) => {
    await renderWithProviders(
      <Button label="Get All Access" onPress={jest.fn()} size={size} />,
    );
    const style = flatStyle(gradient()?.props?.style);
    expect(style.height).toBe(height);
    expect(style.borderRadius).toBe(height / 2);
  });

  it.each([
    ['sm', 44],
    ['md', 54],
    ['lg', 62],
  ] as const)('is tall enough to read as a soft shape at %s', async (size, height) => {
    await renderWithProviders(
      <Button label="Get All Access" onPress={jest.fn()} size={size} />,
    );
    const label = screen.getByText('Get All Access');
    const fontSize = Number(flatStyle(label.props.style).fontSize);
    // The reference is roughly three and a half times its own text height.
    expect(height / fontSize).toBeGreaterThan(3);
  });

  it('clears the minimum touch target even at its smallest', async () => {
    await renderWithProviders(
      <Button label="Remove" onPress={jest.fn()} size="sm" />,
    );
    expect(Number(flatStyle(gradient()?.props?.style).height)).toBeGreaterThanOrEqual(44);
  });

  it('pads generously, so it does not read as a tag', async () => {
    await renderWithProviders(<Button label="Get All Access" onPress={jest.fn()} />);
    const style = flatStyle(gradient()?.props?.style);
    expect(Number(style.paddingHorizontal)).toBeGreaterThanOrEqual(24);
  });
});

describe('icons inside a button', () => {
  it('paints a leading icon white, whatever colour the call site asked for', async () => {
    // Call sites chose colours to suit the fill their variant used to have.
    // Dark ink on the gradient would be unreadable, so the button overrides.
    await renderWithProviders(
      <Button
        label="Back"
        variant="tonal"
        onPress={jest.fn()}
        leading={<Icon name="chevronLeft" size={18} color="text" />}
      />,
    );
    const path = findNode((node) => node.type === 'RNSVGPath');
    const stroke = path?.props?.stroke as { payload?: number } | undefined;
    expect(stroke?.payload).toBe(processColor(palettes.light.textOnCta));
  });

  it('paints a trailing icon the same way', async () => {
    await renderWithProviders(
      <Button
        label="Next"
        variant="secondary"
        onPress={jest.fn()}
        trailing={<Icon name="chevronRight" size={18} color="textSubtle" />}
      />,
    );
    const path = findNode((node) => node.type === 'RNSVGPath');
    const stroke = path?.props?.stroke as { payload?: number } | undefined;
    expect(stroke?.payload).toBe(processColor(palettes.light.textOnCta));
  });

  it('shows a spinner instead of the icon while loading', async () => {
    await renderWithProviders(
      <Button
        label="Saving"
        onPress={jest.fn()}
        loading
        leading={<Icon name="check" size={18} color="text" />}
      />,
    );
    expect(findNode((node) => node.type === 'ActivityIndicator')).not.toBeNull();
  });
});
