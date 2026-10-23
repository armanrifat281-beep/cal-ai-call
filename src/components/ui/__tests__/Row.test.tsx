import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { Badge } from '../Badge';
import { Row } from '../Row';

/**
 * A scan result put its provenance badge in the row's leading slot, which is
 * a fixed 26px column so that every separator insets to the same place. The
 * badge did not clip there - it wrapped, one letter per line, into a ribbon
 * taller than the phone, and a single food filled the whole screen.
 *
 * Two things keep that from coming back: the badge refuses to shrink, and
 * anything wider than a glyph goes in `below` instead.
 */

type Node = ReturnType<typeof screen.getByText>;

/** Every style on the path from a node up to the root, flattened. */
function ancestorStyles(node: Node) {
  const out: Record<string, unknown>[] = [];
  let current: Node | null = node;
  while (current) {
    const style = StyleSheet.flatten(current.props?.style);
    if (style) out.push(style as Record<string, unknown>);
    current = current.parent;
  }
  return out;
}

const LABEL = 'AI estimate - fairly sure';

describe('Row', () => {
  it('keeps a badge out of the fixed-width leading column', async () => {
    await renderWithProviders(
      <Row title="Roasted chicken" subtitle="1 serving" below={<Badge label={LABEL} />} />,
    );

    const widths = ancestorStyles(screen.getByText(LABEL)).map((s) => s.width);
    expect(widths).not.toContain(26);
  });

  it('still renders the below slot', async () => {
    await renderWithProviders(
      <Row title="Roasted chicken" subtitle="1 serving" below={<Badge label={LABEL} />} />,
    );
    expect(screen.getByText(LABEL)).toBeTruthy();
  });

  it('leaves the leading slot at 26px, so separators stay aligned', async () => {
    await renderWithProviders(
      <Row title="Roasted chicken" leading={<Badge label="x" />} />,
    );

    const widths = ancestorStyles(screen.getByText('x')).map((s) => s.width);
    expect(widths).toContain(26);
  });
});

describe('Badge', () => {
  it('never shrinks, so a crowded row cannot wrap it one letter per line', async () => {
    await renderWithProviders(<Badge label={LABEL} />);

    const shrinks = ancestorStyles(screen.getByText(LABEL))
      .map((s) => s.flexShrink)
      .filter((v) => v !== undefined);
    expect(shrinks).toContain(0);
  });
});
