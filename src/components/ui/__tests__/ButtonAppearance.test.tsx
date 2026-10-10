import { screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { palettes } from '@/theme';
import { renderWithProviders } from '@/test/renderWithProviders';

import { Button } from '../Button';

/**
 * Pins the call-to-action treatment from the supplied reference: a fully
 * rounded pill with the rose-to-crimson gradient and white text.
 *
 * These walk the rendered tree, so they catch the treatment being changed or
 * applied to the wrong variants. They cannot tell you it LOOKS right on a
 * device; that still needs eyes.
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

describe('the call-to-action button', () => {
  it('renders a gradient for primary', async () => {
    await renderWithProviders(<Button label="Get All Access" onPress={jest.fn()} />);
    expect(gradient()).not.toBeNull();
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

  // One render per case: unmounting inside a loop detaches `screen`, so
  // every later assertion in the file sees an empty tree.
  it.each([
    ['sm', 36],
    ['md', 48],
    ['lg', 54],
  ] as const)('is a true pill at %s: radius is half the height', async (size, height) => {
    await renderWithProviders(
      <Button label="Get All Access" onPress={jest.fn()} size={size} />,
    );
    const style = flatStyle(gradient()?.props?.style);
    expect(style.height).toBe(height);
    expect(style.borderRadius).toBe(height / 2);
  });

  it('applies the same treatment to accent, the other hero action', async () => {
    await renderWithProviders(
      <Button label="Take a photo" variant="accent" onPress={jest.fn()} />,
    );
    expect(gradient()).not.toBeNull();
  });

  it('writes its label in white', async () => {
    await renderWithProviders(<Button label="Get All Access" onPress={jest.fn()} />);
    const style = flatStyle(screen.getByText('Get All Access').props.style);
    expect(style.color).toBe(palettes.light.textOnCta);
  });

  it('keeps the label bold and on one line', async () => {
    await renderWithProviders(<Button label="Get All Access" onPress={jest.fn()} />);
    const label = screen.getByText('Get All Access');
    expect(flatStyle(label.props.style).fontWeight).toBe('600');
    expect(label.props.numberOfLines).toBe(1);
  });
});

describe('the gradient stays scarce', () => {
  it.each(['tonal', 'secondary', 'ghost', 'danger'] as const)(
    'does not apply it to %s',
    async (variant) => {
      await renderWithProviders(
        <Button label="Secondary" variant={variant} onPress={jest.fn()} />,
      );
      // If every button were the call to action there would be no call to
      // action. This is what keeps the treatment meaningful.
      expect(gradient()).toBeNull();
    },
  );

  it('keeps destructive actions flat, so they cannot be mistaken for the CTA', async () => {
    await renderWithProviders(
      <Button label="Delete" variant="danger" onPress={jest.fn()} />,
    );
    expect(gradient()).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });
});

describe('every variant is a pill', () => {
  it.each(['tonal', 'secondary', 'danger'] as const)(
    'rounds %s to half its height',
    async (variant) => {
      await renderWithProviders(
        <Button label="Action" variant={variant} size="md" onPress={jest.fn()} />,
      );
      const shaped = findNode((node) => {
        const style = flatStyle(node.props?.style);
        return style.borderRadius === 24 && style.height === 48;
      });
      expect(shaped).not.toBeNull();
    },
  );
});
