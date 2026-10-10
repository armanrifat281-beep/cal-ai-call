/**
 * Arc geometry for the day plate.
 *
 * Pure maths, kept out of the component so it can be tested without
 * rendering. Angles are in degrees, measured clockwise from twelve o'clock,
 * which is how a person describes a position on a dial.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * A point on a circle.
 *
 * SVG's y axis points down and its angles start at three o'clock, so the
 * conversion subtracts 90 degrees to put zero at the top.
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDegrees: number,
): Point {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

/**
 * An annular sector: the filled band between two radii, over a sweep.
 *
 * Returned as a closed path so it can be filled, rather than a stroked arc.
 * A stroked arc cannot have rounded ends and a flat inner edge at once, and
 * the plate needs both.
 */
export function annularSectorPath(options: {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
}): string {
  const { cx, cy, innerRadius, outerRadius, startAngle } = options;
  let { endAngle } = options;

  // A full circle cannot be drawn as one arc: the start and end points
  // coincide and the renderer draws nothing. Stop just short.
  const sweep = endAngle - startAngle;
  if (sweep >= 360) endAngle = startAngle + 359.999;
  if (sweep <= 0) return '';

  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// Laying out the plate
// ---------------------------------------------------------------------------

export interface PlateInput {
  /** A stable key, so a segment keeps its identity across renders. */
  id: string;
  /** Energy for this meal. Segments are sized by share of the total. */
  value: number;
  /** Energy from protein, carbs and fat, used to split the segment. */
  parts: { protein: number; carbs: number; fat: number };
}

export type MacroKey = 'protein' | 'carbs' | 'fat';

export interface PlateBand {
  key: MacroKey;
  startAngle: number;
  endAngle: number;
}

export interface PlateSlice {
  id: string;
  startAngle: number;
  endAngle: number;
  /** The protein, carbs and fat bands inside this meal's arc. */
  bands: PlateBand[];
}

export interface PlateLayout {
  slices: PlateSlice[];
  /** True when there is nothing to draw, so the caller can show the track. */
  isEmpty: boolean;
  /**
   * The fraction of the dial the meals fill, 0 to 1. In progress mode this is
   * the day's share of its target; in composition mode it is always 1.
   */
  filledFraction: number;
  /** True when the day exceeded `fullValue`, so the ring is capped at full. */
  isOverflowing: boolean;
}

/**
 * Below this sweep an arc covers less than a pixel at any plate size we draw,
 * so it reads as nothing at all. The layout reports itself empty rather than
 * emitting a slice that cannot be seen; the centre figure still carries the
 * amount, which is the honest place for it in progress mode — inflating the
 * arc to make it visible would overstate how far the day has got.
 */
const MIN_DRAWABLE_DEGREES = 0.5;

/**
 * The most of the drawn arc that the gaps between meals may consume. Past
 * this the gaps shrink, because a dial that reads as empty when food has in
 * fact been logged is worse than meals that nearly touch.
 */
const MAX_GAP_SHARE = 0.4;

export interface LayoutPlateOptions {
  /** Space left between meals, so adjacent arcs do not merge. */
  gapDegrees?: number;
  /** A floor, so a small meal stays visible rather than becoming a hairline. */
  minSliceDegrees?: number;
  /** Where the first meal begins. Zero is twelve o'clock. */
  startAngle?: number;
  /**
   * Progress mode. When given, a full turn represents this value — typically
   * the day's energy target — so how far the ring has travelled reads as
   * progress. The ring caps at a full turn and reports `isOverflowing`.
   *
   * Omit it for composition mode, where the meals always fill the dial and
   * only their relative sizes carry meaning.
   */
  fullValue?: number;
}

function splitIntoBands(meal: PlateInput, startAngle: number, sweep: number): PlateBand[] {
  const partTotal = meal.parts.protein + meal.parts.carbs + meal.parts.fat;
  if (partTotal <= 0) return [];

  const bands: PlateBand[] = [];
  let cursor = startAngle;
  for (const key of ['protein', 'carbs', 'fat'] as const) {
    const bandSweep = (meal.parts[key] / partTotal) * sweep;
    if (bandSweep <= 0) continue;
    bands.push({ key, startAngle: cursor, endAngle: cursor + bandSweep });
    cursor += bandSweep;
  }
  return bands;
}

/**
 * Lays out the day's meals around the plate.
 *
 * Each meal takes a share of the dial proportional to its energy, and is then
 * split into protein, carb and fat bands by how much of that meal's energy
 * each macro supplied. So the ring reads three ways at once: how far it has
 * travelled is the day's progress, the gaps show how the day broke into
 * meals, and the colour shows what those meals were made of.
 *
 * The gaps between meals are taken out of the drawn arc rather than added to
 * it, so a few meals' worth of gaps understate progress by around one per
 * cent. That is below the precision of any nutrition estimate and is the
 * price of segments that can be told apart at all.
 */
export function layoutPlate(
  meals: readonly PlateInput[],
  options: LayoutPlateOptions = {},
): PlateLayout {
  const gap = options.gapDegrees ?? 3;
  const minSlice = options.minSliceDegrees ?? 6;
  const start = options.startAngle ?? 0;
  const { fullValue } = options;

  const empty: PlateLayout = {
    slices: [],
    isEmpty: true,
    filledFraction: 0,
    isOverflowing: false,
  };

  const usable = meals.filter((meal) => meal.value > 0);
  if (usable.length === 0) return empty;

  const total = usable.reduce((sum, meal) => sum + meal.value, 0);
  if (total <= 0) return empty;

  // In composition mode the meals always fill the dial. In progress mode they
  // fill their share of the target, and stop at a full turn.
  const isProgressMode = fullValue !== undefined && fullValue > 0;
  const rawFraction = isProgressMode ? total / fullValue : 1;
  const filledFraction = Math.min(rawFraction, 1);
  const isOverflowing = isProgressMode && rawFraction > 1;

  // The gaps are carved out of the drawn arc, so on a barely-started day they
  // could swallow it whole and leave the dial looking broken rather than
  // nearly empty. Cap what they may take, and they shrink to fit instead.
  const rawSweep = 360 * filledFraction;
  const effectiveGap =
    usable.length > 1
      ? Math.min(gap, (rawSweep * MAX_GAP_SHARE) / usable.length)
      : 0;

  const totalGap = effectiveGap * usable.length;
  const available = Math.max(rawSweep - totalGap, 0);
  if (available < MIN_DRAWABLE_DEGREES) {
    return { slices: [], isEmpty: true, filledFraction, isOverflowing };
  }

  // Enforce the floor, then rescale if the floors no longer fit. The rescale
  // matters most in progress mode: a floor must never make a small day look
  // like a larger one.
  const rawShares = usable.map((meal) => (meal.value / total) * available);
  const floored = rawShares.map((share) => Math.max(share, minSlice));
  const flooredTotal = floored.reduce((sum, share) => sum + share, 0);
  const scale = flooredTotal > available ? available / flooredTotal : 1;
  const shares = floored.map((share) => share * scale);

  const slices: PlateSlice[] = [];
  let cursor = start + effectiveGap / 2;

  usable.forEach((meal, index) => {
    const sweep = shares[index] ?? 0;
    const sliceStart = cursor;
    const sliceEnd = cursor + sweep;
    slices.push({
      id: meal.id,
      startAngle: sliceStart,
      endAngle: sliceEnd,
      bands: splitIntoBands(meal, sliceStart, sweep),
    });
    cursor = sliceEnd + effectiveGap;
  });

  return { slices, isEmpty: false, filledFraction, isOverflowing };
}
