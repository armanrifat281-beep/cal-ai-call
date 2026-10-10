import {
  annularSectorPath,
  layoutPlate,
  polarToCartesian,
  type PlateBand,
  type PlateInput,
} from '../arc';

function meal(id: string, value: number, parts = { protein: 1, carbs: 1, fat: 1 }): PlateInput {
  return { id, value, parts };
}

describe('polarToCartesian', () => {
  it('puts zero degrees at twelve o\'clock, not three', () => {
    const point = polarToCartesian(50, 50, 10, 0);
    expect(point.x).toBeCloseTo(50, 6);
    expect(point.y).toBeCloseTo(40, 6);
  });

  it('runs clockwise', () => {
    // 90 degrees should be to the RIGHT of centre.
    const point = polarToCartesian(50, 50, 10, 90);
    expect(point.x).toBeCloseTo(60, 6);
    expect(point.y).toBeCloseTo(50, 6);
  });

  it('reaches the bottom at 180 degrees', () => {
    const point = polarToCartesian(50, 50, 10, 180);
    expect(point.x).toBeCloseTo(50, 6);
    expect(point.y).toBeCloseTo(60, 6);
  });
});

describe('annularSectorPath', () => {
  const base = { cx: 50, cy: 50, innerRadius: 30, outerRadius: 40 };

  it('draws a closed path with both arcs', () => {
    const path = annularSectorPath({ ...base, startAngle: 0, endAngle: 90 });
    expect(path.startsWith('M ')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path.match(/A /g)).toHaveLength(2);
  });

  it('sets the large-arc flag only past a half turn', () => {
    const small = annularSectorPath({ ...base, startAngle: 0, endAngle: 90 });
    const large = annularSectorPath({ ...base, startAngle: 0, endAngle: 270 });
    expect(small).toContain(`${base.outerRadius} 0 0 1`);
    expect(large).toContain(`${base.outerRadius} 0 1 1`);
  });

  it('returns nothing for a zero or negative sweep, rather than a broken path', () => {
    expect(annularSectorPath({ ...base, startAngle: 40, endAngle: 40 })).toBe('');
    expect(annularSectorPath({ ...base, startAngle: 90, endAngle: 10 })).toBe('');
  });

  it('stops a full circle just short, because one arc cannot close on itself', () => {
    const path = annularSectorPath({ ...base, startAngle: 0, endAngle: 360 });
    expect(path).not.toBe('');
    // The end point must differ from the start, or nothing renders.
    const [, startX, startY] = /^M ([\d.-]+) ([\d.-]+)/.exec(path) ?? [];
    expect(path).not.toContain(`A 40 40 0 1 1 ${startX} ${startY}`);
  });
});

describe('layoutPlate', () => {
  it('reports empty when there is nothing to draw', () => {
    expect(layoutPlate([]).isEmpty).toBe(true);
    expect(layoutPlate([meal('a', 0)]).isEmpty).toBe(true);
  });

  it('gives a single meal the whole circle, minus no gap', () => {
    const { slices } = layoutPlate([meal('a', 500)]);
    expect(slices).toHaveLength(1);
    expect((slices[0]?.endAngle ?? 0) - (slices[0]?.startAngle ?? 0)).toBeCloseTo(360, 4);
  });

  it('sizes meals by their share of the day', () => {
    const { slices } = layoutPlate([meal('a', 300), meal('b', 900)], {
      gapDegrees: 0,
      minSliceDegrees: 0,
    });
    const sweepA = (slices[0]?.endAngle ?? 0) - (slices[0]?.startAngle ?? 0);
    const sweepB = (slices[1]?.endAngle ?? 0) - (slices[1]?.startAngle ?? 0);
    expect(sweepB / sweepA).toBeCloseTo(3, 4);
  });

  it('leaves a gap between meals, so similar colours do not merge', () => {
    const { slices } = layoutPlate([meal('a', 500), meal('b', 500)], { gapDegrees: 10 });
    const gap = (slices[1]?.startAngle ?? 0) - (slices[0]?.endAngle ?? 0);
    expect(gap).toBeCloseTo(10, 4);
  });

  it('never exceeds a full turn, however many meals', () => {
    for (const count of [1, 2, 5, 12]) {
      const meals = Array.from({ length: count }, (_u, i) => meal(`m${i}`, 100));
      const { slices } = layoutPlate(meals);
      const last = slices[slices.length - 1];
      expect((last?.endAngle ?? 0) - (slices[0]?.startAngle ?? 0)).toBeLessThanOrEqual(360.001);
    }
  });

  it('keeps a tiny meal visible rather than collapsing it to a hairline', () => {
    // A 20 kcal coffee beside a 2000 kcal day would be 3.6 degrees.
    const { slices } = layoutPlate([meal('coffee', 20), meal('dinner', 2000)], {
      minSliceDegrees: 8,
      gapDegrees: 0,
    });
    const coffee = (slices[0]?.endAngle ?? 0) - (slices[0]?.startAngle ?? 0);
    expect(coffee).toBeGreaterThanOrEqual(7.9);
  });

  it('still fits in a circle once the floor has been applied', () => {
    const meals = Array.from({ length: 20 }, (_u, i) => meal(`m${i}`, i === 0 ? 2000 : 5));
    const { slices } = layoutPlate(meals, { minSliceDegrees: 10, gapDegrees: 2 });
    const last = slices[slices.length - 1];
    expect(last?.endAngle ?? 0).toBeLessThanOrEqual(360.001);
  });

  it('splits each meal into macro bands by energy contribution', () => {
    const { slices } = layoutPlate(
      [meal('a', 400, { protein: 100, carbs: 200, fat: 100 })],
      { gapDegrees: 0, minSliceDegrees: 0 },
    );
    const bands = slices[0]?.bands ?? [];
    expect(bands.map((band) => band.key)).toEqual(['protein', 'carbs', 'fat']);

    const sweep = (band: { startAngle: number; endAngle: number }) =>
      band.endAngle - band.startAngle;
    // Carbs supplied half the energy, so they take half the arc.
    expect(sweep(bands[1]!)).toBeCloseTo(180, 3);
    expect(sweep(bands[0]!)).toBeCloseTo(90, 3);
  });

  it('omits a macro that contributed nothing', () => {
    const { slices } = layoutPlate(
      [meal('a', 400, { protein: 0, carbs: 400, fat: 0 })],
      { gapDegrees: 0 },
    );
    expect(slices[0]?.bands.map((band) => band.key)).toEqual(['carbs']);
  });

  it('leaves a meal with no macro data unbanded rather than guessing', () => {
    const { slices } = layoutPlate(
      [meal('a', 400, { protein: 0, carbs: 0, fat: 0 })],
      { gapDegrees: 0 },
    );
    expect(slices[0]?.bands).toEqual([]);
    // The slice itself still exists, so the energy is not hidden.
    expect(slices[0]?.endAngle).toBeGreaterThan(slices[0]?.startAngle ?? 0);
  });

  it('bands tile their slice exactly, with no seam or overlap', () => {
    const { slices } = layoutPlate(
      [meal('a', 500, { protein: 120, carbs: 250, fat: 130 })],
      { gapDegrees: 0 },
    );
    const slice = slices[0]!;
    expect(slice.bands[0]?.startAngle).toBeCloseTo(slice.startAngle, 6);
    expect(slice.bands[slice.bands.length - 1]?.endAngle).toBeCloseTo(slice.endAngle, 6);
    for (let i = 1; i < slice.bands.length; i += 1) {
      expect(slice.bands[i]?.startAngle).toBeCloseTo(slice.bands[i - 1]!.endAngle, 6);
    }
  });

  it('keeps segment identity, so a meal can be highlighted', () => {
    const { slices } = layoutPlate([meal('breakfast', 300), meal('dinner', 700)]);
    expect(slices.map((slice) => slice.id)).toEqual(['breakfast', 'dinner']);
  });

  it('fills the dial in composition mode, whatever the values', () => {
    const small = layoutPlate([meal('a', 10)]);
    const large = layoutPlate([meal('a', 5000)]);
    expect(small.filledFraction).toBe(1);
    expect(large.filledFraction).toBe(1);
    expect(small.isOverflowing).toBe(false);
  });
});

describe('layoutPlate in progress mode', () => {
  it('travels only as far as the day has got', () => {
    const { filledFraction } = layoutPlate([meal('a', 500)], { fullValue: 2000 });
    expect(filledFraction).toBeCloseTo(0.25, 6);
  });

  it('sweeps a quarter turn for a quarter of the target', () => {
    const { slices } = layoutPlate([meal('a', 500)], { fullValue: 2000, gapDegrees: 0 });
    const sweep = (slices[0]?.endAngle ?? 0) - (slices[0]?.startAngle ?? 0);
    expect(sweep).toBeCloseTo(90, 4);
  });

  it('caps at a full turn and says so when the day goes over', () => {
    const layout = layoutPlate([meal('a', 3000)], { fullValue: 2000, gapDegrees: 0 });
    expect(layout.filledFraction).toBe(1);
    expect(layout.isOverflowing).toBe(true);
    const sweep = (layout.slices[0]?.endAngle ?? 0) - (layout.slices[0]?.startAngle ?? 0);
    expect(sweep).toBeCloseTo(360, 4);
  });

  it('does not report overflow when the day lands exactly on target', () => {
    const layout = layoutPlate([meal('a', 2000)], { fullValue: 2000 });
    expect(layout.filledFraction).toBe(1);
    expect(layout.isOverflowing).toBe(false);
  });

  it('never lets the minimum-size floor overstate a small day', () => {
    // Three tiny meals against a big target. With a 6 degree floor the naive
    // sweep would be 18 degrees — five per cent of the dial — for a day that
    // is one per cent of its target.
    const layout = layoutPlate(
      [meal('a', 7), meal('b', 7), meal('c', 6)],
      { fullValue: 2000, minSliceDegrees: 6, gapDegrees: 2 },
    );
    const drawn = layout.slices.reduce(
      (sum, slice) => sum + (slice.endAngle - slice.startAngle),
      0,
    );
    // One per cent of 360 is 3.6 degrees, less the gaps.
    expect(drawn).toBeLessThanOrEqual(3.6);
  });

  it('treats a zero or negative target as composition mode, not a divide by zero', () => {
    for (const fullValue of [0, -100]) {
      const layout = layoutPlate([meal('a', 500)], { fullValue });
      expect(layout.filledFraction).toBe(1);
      expect(Number.isFinite(layout.slices[0]?.endAngle ?? NaN)).toBe(true);
    }
  });

  it('reports empty rather than drawing a sliver too small to see', () => {
    const layout = layoutPlate([meal('a', 1)], { fullValue: 1_000_000, gapDegrees: 3 });
    // A millionth of a turn, minus a gap, leaves nothing drawable.
    expect(layout.isEmpty).toBe(true);
    // But the fraction is still reported, so the caller can say "barely any".
    expect(layout.filledFraction).toBeGreaterThan(0);
  });

  it('shrinks the gaps rather than letting them swallow a barely-started day', () => {
    // Two small meals, 2% of target. Full 5 degree gaps would consume more
    // than the 7.4 degrees of arc there is to draw, leaving an empty dial.
    const layout = layoutPlate([meal('a', 25), meal('b', 20)], {
      fullValue: 2200,
      gapDegrees: 5,
    });

    expect(layout.isEmpty).toBe(false);
    const drawn = layout.slices.reduce(
      (sum, slice) => sum + (slice.endAngle - slice.startAngle),
      0,
    );
    expect(drawn).toBeGreaterThan(0.5);
    // Still never more than the day actually earned.
    expect(drawn).toBeLessThanOrEqual(360 * (45 / 2200) + 0.001);
  });

  it('leaves the gaps alone when there is plenty of arc to take them from', () => {
    const layout = layoutPlate([meal('a', 1000), meal('b', 1000)], {
      fullValue: 2200,
      gapDegrees: 5,
    });
    const gap = (layout.slices[1]?.startAngle ?? 0) - (layout.slices[0]?.endAngle ?? 0);
    expect(gap).toBeCloseTo(5, 4);
  });

  it('still splits macros correctly when the ring is partly filled', () => {
    const { slices } = layoutPlate(
      [meal('a', 500, { protein: 100, carbs: 300, fat: 100 })],
      { fullValue: 2000, gapDegrees: 0 },
    );
    const bands = slices[0]?.bands ?? [];
    const sweep = (band: PlateBand) => band.endAngle - band.startAngle;
    // The slice is 90 degrees; carbs took three fifths of the meal's energy.
    expect(sweep(bands[1]!)).toBeCloseTo(54, 3);
  });
});
