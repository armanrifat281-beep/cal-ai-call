import { render, screen, userEvent } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme';
import { EMPTY_NUTRIENTS, type Nutrients } from '@/types/domain';

import { DayPlate, type DayPlateSegment } from '../DayPlate';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function nutrients(partial: Partial<Nutrients>): Nutrients {
  return { ...EMPTY_NUTRIENTS, ...partial };
}

function segment(
  id: string,
  label: string,
  caloriesKcal: number,
  macros: Partial<Nutrients> = { proteinG: 10, carbsG: 20, fatG: 5 },
): DayPlateSegment {
  return { id, label, nutrients: nutrients({ caloriesKcal, ...macros }) };
}

/**
 * Collects every node of a type from the rendered tree.
 *
 * The chart is SVG, so there is no text or role to query for the arcs
 * themselves. Walking the rendered output is how their count and fill can be
 * asserted. Note that a rendered node keeps its children in `children`, not
 * in `props.children`.
 */
function nodesOfType(type: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const element = node as {
      type?: unknown;
      props?: Record<string, unknown>;
      children?: unknown;
    };
    if (element.type === type) found.push(element.props ?? {});
    if (element.children) walk(element.children);
  };
  walk(screen.toJSON());
  return found;
}

/**
 * The coloured bands only.
 *
 * Each meal also renders an invisible, wider path that carries the press, so
 * a raw path count would mix the drawing up with the touch target.
 */
function bands(): Record<string, unknown>[] {
  return nodesOfType('RNSVGPath').filter((path) => {
    const fill = path['fill'] as { payload?: number } | undefined;
    // A transparent fill comes back as an ARGB integer with a zero alpha.
    return fill?.payload !== 0;
  });
}

function hitTargets(): Record<string, unknown>[] {
  return nodesOfType('RNSVGPath').filter((path) => {
    const fill = path['fill'] as { payload?: number } | undefined;
    return fill?.payload === 0;
  });
}

const BREAKFAST = segment('breakfast', 'Breakfast', 420);
const LUNCH = segment('lunch', 'Lunch', 680);

describe('DayPlate', () => {
  it('shows the day total in the middle', async () => {
    await renderWithTheme(
      <DayPlate segments={[BREAKFAST, LUNCH]} targetKcal={2000} />,
    );
    expect(screen.getByText('1100')).toBeTruthy();
  });

  it('names the target beside the total, so the figure is not bare', async () => {
    await renderWithTheme(<DayPlate segments={[BREAKFAST]} targetKcal={2000} />);
    expect(screen.getByText('of 2000 kcal')).toBeTruthy();
  });

  it('claims no progress when no target is set', async () => {
    await renderWithTheme(<DayPlate segments={[BREAKFAST]} targetKcal={null} />);
    expect(screen.getByText('kcal today')).toBeTruthy();
    expect(screen.queryByText(/^of /)).toBeNull();
  });

  it('draws a zero with an empty day rather than nothing at all', async () => {
    await renderWithTheme(<DayPlate segments={[]} targetKcal={2000} />);
    expect(screen.getByText('0')).toBeTruthy();
    // The track is still drawn, so the dial reads as empty rather than broken.
    expect(nodesOfType('RNSVGCircle').length).toBe(1);
    expect(bands().length).toBe(0);
  });

  it('draws one band per macro present, per meal', async () => {
    await renderWithTheme(
      <DayPlate segments={[BREAKFAST, LUNCH]} targetKcal={2000} />,
    );
    // Two meals, each with protein, carbs and fat.
    expect(bands()).toHaveLength(6);
  });

  it('omits a macro a meal did not contain', async () => {
    const noFat = segment('a', 'Snack', 200, { proteinG: 10, carbsG: 40, fatG: 0 });
    await renderWithTheme(<DayPlate segments={[noFat]} targetKcal={2000} />);
    expect(bands()).toHaveLength(2);
  });

  it('draws a single neutral arc when a meal has no macro data to split', async () => {
    const unknown = segment('a', 'Leftovers', 300, {
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
    await renderWithTheme(<DayPlate segments={[unknown]} targetKcal={2000} />);
    const paths = bands();
    expect(paths).toHaveLength(1);
    // Not tinted as any macro, because none was measured.
    expect(paths[0]?.['d']).toBeTruthy();
  });

  it('moves the middle figure onto a meal when its arc is tapped', async () => {
    const user = userEvent.setup();
    await renderWithTheme(
      <DayPlate segments={[BREAKFAST, LUNCH]} targetKcal={2000} onSelect={jest.fn()} />,
    );

    expect(screen.getByText('1100')).toBeTruthy();
    await user.press(screen.getByLabelText('Lunch, 680 kilocalories'));

    expect(screen.getByText('680')).toBeTruthy();
    expect(screen.getByText('Lunch')).toBeTruthy();
    expect(screen.queryByText('1100')).toBeNull();
  });

  it('returns to the day total when the same arc is tapped again', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    await renderWithTheme(
      <DayPlate segments={[BREAKFAST, LUNCH]} targetKcal={2000} onSelect={onSelect} />,
    );

    const arc = screen.getByLabelText('Lunch, 680 kilocalories');
    await user.press(arc);
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'lunch' }));

    await user.press(screen.getByLabelText('Lunch, 680 kilocalories'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(screen.getByText('1100')).toBeTruthy();
  });

  it('marks where the target fell once the day goes past it', async () => {
    const big = segment('a', 'Feast', 2600);
    await renderWithTheme(<DayPlate segments={[big]} targetKcal={2000} />);

    // The dial rescales to the day, so the ring comes round to full...
    expect(bands()).toHaveLength(3);
    // ...and a mark shows where the target was crossed: a notch through the
    // band plus an ink tick outside it, which is what tells the mark apart
    // from the plain gaps between meals.
    expect(nodesOfType('RNSVGLine')).toHaveLength(2);
    // The figure still reports the real total, not a capped one.
    expect(screen.getByText('2600')).toBeTruthy();
    expect(screen.getByText('of 2000 kcal')).toBeTruthy();
  });

  it('puts the target tick at the fraction of the day the target represents', async () => {
    // 2000 of 2600 is 277 degrees clockwise from twelve o'clock - just past
    // nine o'clock and climbing - so the tick sits in the upper left
    // quadrant: left of centre and above it.
    await renderWithTheme(
      <DayPlate segments={[segment('a', 'Feast', 2600)]} targetKcal={2000} size={200} />,
    );
    const tick = nodesOfType('RNSVGLine')[0];
    const centre = 200 / 2 + 9;
    expect(Number(tick?.['x1'])).toBeLessThan(centre);
    expect(Number(tick?.['y1'])).toBeLessThan(centre);
  });

  it('draws no tick while the day is still under target', async () => {
    await renderWithTheme(<DayPlate segments={[BREAKFAST]} targetKcal={2000} />);
    expect(bands()).toHaveLength(3);
    expect(nodesOfType('RNSVGLine')).toHaveLength(0);
  });

  it('draws the outer tick in ink, so it never fights a macro colour', async () => {
    await renderWithTheme(
      <DayPlate segments={[segment('a', 'Feast', 2600)]} targetKcal={2000} />,
    );
    const [notch, tick] = nodesOfType('RNSVGLine');
    // The notch is the wider of the two, and the ink tick rides outside it.
    expect(Number(notch?.['strokeWidth'])).toBeGreaterThan(
      Number(tick?.['strokeWidth']),
    );
  });

  it('draws no tick when there is no target to cross', async () => {
    await renderWithTheme(<DayPlate segments={[BREAKFAST, LUNCH]} targetKcal={null} />);
    expect(nodesOfType('RNSVGLine')).toHaveLength(0);
  });

  it('gives each meal a touch target wider than the band it draws', async () => {
    await renderWithTheme(
      <DayPlate segments={[BREAKFAST, LUNCH]} targetKcal={2000} onSelect={jest.fn()} />,
    );
    // One per meal, separate from the three colour bands each one draws.
    expect(hitTargets()).toHaveLength(2);
    expect(bands()).toHaveLength(6);
  });

  it('describes the whole day to a screen reader', async () => {
    await renderWithTheme(
      <DayPlate segments={[BREAKFAST, LUNCH]} targetKcal={2000} />,
    );
    const label = screen.getByLabelText(/1100 kilocalories logged today/);
    expect(label).toBeTruthy();
    expect(
      screen.getByLabelText(/across 2 meals: Breakfast, 420 kilocalories; Lunch, 680/),
    ).toBeTruthy();
  });

  it('tells a screen reader the day is empty rather than reading a bare zero', async () => {
    await renderWithTheme(<DayPlate segments={[]} targetKcal={2000} />);
    expect(screen.getByLabelText('Nothing logged yet today.')).toBeTruthy();
  });

  it('states progress as a percentage for a screen reader', async () => {
    await renderWithTheme(<DayPlate segments={[segment('a', 'Lunch', 1000)]} targetKcal={2000} />);
    expect(screen.getByLabelText(/50 per cent of a 2000 kilocalorie target/)).toBeTruthy();
  });
});
