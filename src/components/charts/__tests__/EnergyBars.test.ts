import { layoutEnergyBars, type EnergyBarDay } from '../EnergyBars';

function day(dateKey: string, caloriesKcal: number, hasData = true): EnergyBarDay {
  return { dateKey, caloriesKcal, hasData };
}

describe('layoutEnergyBars', () => {
  it('scales bars against the biggest day', () => {
    const { bars } = layoutEnergyBars([day('a', 1000), day('b', 2000)], null);
    expect((bars[1]?.fraction ?? 0) / (bars[0]?.fraction ?? 1)).toBeCloseTo(2, 5);
  });

  it('leaves headroom, so the tallest bar never touches the ceiling', () => {
    const { bars } = layoutEnergyBars([day('a', 2000)], null);
    expect(bars[0]?.fraction).toBeLessThan(1);
    expect(bars[0]?.fraction).toBeGreaterThan(0.8);
  });

  it('keeps a day that went well over the target on the same scale', () => {
    // Clipping it flat would make a 4000 kcal day look like a 2000 one.
    const { bars, targetFraction } = layoutEnergyBars([day('a', 4000)], 2000);
    expect(bars[0]?.fraction).toBeLessThanOrEqual(1);
    expect(bars[0]?.fraction).toBeGreaterThan(targetFraction ?? 0);
  });

  it('includes the target in the scale even when every day fell short', () => {
    const { targetFraction } = layoutEnergyBars([day('a', 500)], 2000);
    expect(targetFraction).toBeGreaterThan(0);
    expect(targetFraction).toBeLessThanOrEqual(1);
  });

  it('draws no bar for a day with nothing logged', () => {
    // Nothing logged is not nothing eaten.
    const { bars } = layoutEnergyBars([day('a', 2000), day('b', 0, false)], null);
    expect(bars[1]?.fraction).toBe(0);
    expect(bars[1]?.hasData).toBe(false);
  });

  it('marks the days that went over the target', () => {
    const { bars } = layoutEnergyBars([day('a', 1800), day('b', 2400)], 2000);
    expect(bars[0]?.isOverTarget).toBe(false);
    expect(bars[1]?.isOverTarget).toBe(true);
  });

  it('never marks an unlogged day as over target', () => {
    const { bars } = layoutEnergyBars([day('a', 0, false)], 2000);
    expect(bars[0]?.isOverTarget).toBe(false);
  });

  it('averages only the days that have data', () => {
    // Four logged days at 2000, three with nothing logged. The average is
    // 2000, not 1143.
    const days = [
      day('a', 2000),
      day('b', 2000),
      day('c', 2000),
      day('d', 2000),
      day('e', 0, false),
      day('f', 0, false),
      day('g', 0, false),
    ];
    const { averageKcal, daysWithData } = layoutEnergyBars(days, null);
    expect(averageKcal).toBe(2000);
    expect(daysWithData).toBe(4);
  });

  it('reports no average when nothing was logged at all', () => {
    const { averageKcal, daysWithData } = layoutEnergyBars(
      [day('a', 0, false), day('b', 0, false)],
      2000,
    );
    expect(averageKcal).toBeNull();
    expect(daysWithData).toBe(0);
  });

  it('survives an empty period without dividing by zero', () => {
    const layout = layoutEnergyBars([], 2000);
    expect(layout.bars).toEqual([]);
    expect(Number.isFinite(layout.scaleMax)).toBe(true);
    expect(layout.scaleMax).toBeGreaterThan(0);
  });

  it('has no target line when no target is set', () => {
    expect(layoutEnergyBars([day('a', 1500)], null).targetFraction).toBeNull();
    expect(layoutEnergyBars([day('a', 1500)], 0).targetFraction).toBeNull();
  });
});
