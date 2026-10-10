export interface EnergyBarDay {
  dateKey: string;
  caloriesKcal: number;
  /**
   * Whether anything was logged. A day with nothing logged is not a day with
   * no energy, and the chart must not draw it as one.
   */
  hasData: boolean;
}

export interface EnergyBarsLayout {
  /** The value a full-height bar represents. */
  scaleMax: number;
  bars: {
    dateKey: string;
    /** 0 to 1 of the plot height. Zero for a day with nothing logged. */
    fraction: number;
    hasData: boolean;
    isOverTarget: boolean;
  }[];
  /** Where the target line sits, 0 to 1, or null when there is no target. */
  targetFraction: number | null;
  /** Mean of the days that have data. Null when none do. */
  averageKcal: number | null;
  daysWithData: number;
}

/**
 * Works out the scale for a period of daily energy.
 *
 * The scale has to cover both the biggest day and the target, or a day that
 * went well over would be clipped flat and read as if it had hit the target
 * exactly. The headroom above keeps the tallest bar from touching the top,
 * where it would be ambiguous whether it had been cut off.
 *
 * The average deliberately skips days with nothing logged. Including them
 * would divide a real week's eating by seven and report a number the user
 * never ate, which is the sort of quiet falsehood a chart makes look
 * authoritative.
 */
export function layoutEnergyBars(
  days: readonly EnergyBarDay[],
  targetKcal: number | null,
): EnergyBarsLayout {
  const logged = days.filter((day) => day.hasData);
  const maxLogged = logged.reduce((max, day) => Math.max(max, day.caloriesKcal), 0);
  const target = targetKcal !== null && targetKcal > 0 ? targetKcal : null;

  // Headroom, so the tallest bar never touches the ceiling.
  const ceiling = Math.max(maxLogged, target ?? 0) * 1.12;
  const scaleMax = ceiling > 0 ? ceiling : 1;

  const total = logged.reduce((sum, day) => sum + day.caloriesKcal, 0);

  return {
    scaleMax,
    bars: days.map((day) => ({
      dateKey: day.dateKey,
      fraction: day.hasData ? Math.min(day.caloriesKcal / scaleMax, 1) : 0,
      hasData: day.hasData,
      isOverTarget: target !== null && day.hasData && day.caloriesKcal > target,
    })),
    targetFraction: target !== null ? Math.min(target / scaleMax, 1) : null,
    averageKcal: logged.length > 0 ? total / logged.length : null,
    daysWithData: logged.length,
  };
}
