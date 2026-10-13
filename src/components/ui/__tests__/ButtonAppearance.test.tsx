import { screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { palettes } from '@/theme';
import { renderWithProviders } from '@/test/renderWithProviders';

import { Icon } from '@/components/Icon';

import { Button } from '../Button';

/**
 * Pins the button treatment: a tall, fully rounded pill filled with ink,
 * with the label and any icon reversed out of it, on every variant but
 * `ghost`.
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

/**
 * The filled pill: the view carrying the brand background.
 *
 * Matched against the light palette, because the providers follow the phone
 * and the phone is light under test.
 */
const filled = () =>
  findNode((node) => {
    const style = flatStyle(node.props?.style);
    return (
      style.backgroundColor === palettes.light.primary ||
      style.backgroundColor === palettes.light.primaryPressed
    );
  });

/** Flattens a style prop, which may be an array. */
function flatStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map(flatStyle));
  }
  return (style as Record<string, unknown>) ?? {};
}

/** WCAG contrast of white against a `#rrggbb` fill. */
function contrastWithWhite(hex: string): number {
  const channel = (index: number): number => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05);
}

/** Everything that renders as a filled pill. `ghost` is the one level apart. */
const FILLED = ['primary', 'accent', 'tonal', 'secondary', 'danger'] as const;

describe('every button wears the reference treatment', () => {
  // One render per case: unmounting inside a loop detaches `screen`, so
  // every later assertion in the file sees an empty tree.
  it.each(FILLED)('fills %s as a solid pill', async (variant) => {
    await renderWithProviders(
      <Button label="Get All Access" variant={variant} onPress={jest.fn()} />,
    );
    expect(filled()).not.toBeNull();
  });

  it.each(FILLED)('reverses %s out of the fill', async (variant) => {
    await renderWithProviders(
      <Button label="Get All Access" variant={variant} onPress={jest.fn()} />,
    );
    const style = flatStyle(screen.getByText('Get All Access').props.style);
    // The providers follow the phone, which under test is light.
    expect(style.color).toBe(palettes.light.textOnPrimary);
  });

  /*
    The fill is the brand colour now, not ink. An earlier version required
    it to be grey, on the reasoning that a coloured button competes with
    photographs of food; forest at this depth does not, because it is darker
    than the food in any photograph rather than brighter.

    What actually has to hold is that the label survives on it, so that is
    what is measured.
  */
  it('is dark enough for the label to be readable on it', async () => {
    await renderWithProviders(<Button label="Save meal" onPress={jest.fn()} />);
    const background = flatStyle(filled()?.props?.style).backgroundColor as string;

    // WCAG AA for body text, against the white the label is painted in.
    expect(contrastWithWhite(background)).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves a ghost action as text, so two pills never stack', async () => {
    // Two filled pills in a footer compete, and the smaller one reads as a
    // second call to action rather than as the quiet way out.
    await renderWithProviders(
      <Button label="Skip for now" variant="ghost" onPress={jest.fn()} />,
    );
    expect(filled()).toBeNull();
  });

  it('writes a ghost action in the same ink, so it still belongs', async () => {
    await renderWithProviders(
      <Button label="Skip for now" variant="ghost" onPress={jest.fn()} />,
    );
    const style = flatStyle(screen.getByText('Skip for now').props.style);
    // The providers open in the app's default scheme, which is dark.
    expect(style.color).toBe(palettes.light.primary);
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
    const style = flatStyle(filled()?.props?.style);
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
    expect(Number(flatStyle(filled()?.props?.style).height)).toBeGreaterThanOrEqual(44);
  });

  it('pads generously, so it does not read as a tag', async () => {
    await renderWithProviders(<Button label="Get All Access" onPress={jest.fn()} />);
    const style = flatStyle(filled()?.props?.style);
    expect(Number(style.paddingHorizontal)).toBeGreaterThanOrEqual(24);
  });
});

describe('icons inside a button', () => {
  it('paints a leading icon white, whatever colour the call site asked for', async () => {
    // Call sites chose colours to suit the fill their variant used to have.
    // A dark icon on the forest fill would be unreadable, so the button
    // overrides whatever was asked for and paints it out of the fill.
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
    expect(stroke?.payload).toBe(processColor(palettes.light.textOnPrimary));
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
    expect(stroke?.payload).toBe(processColor(palettes.light.textOnPrimary));
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
