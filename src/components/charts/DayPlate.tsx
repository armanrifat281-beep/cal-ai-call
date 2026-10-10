import { useMemo, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { Text } from '@/components/ui';
import { KCAL_PER_GRAM } from '@/features/nutrition';
import { useTheme } from '@/theme';
import type { Nutrients } from '@/types/domain';

import {
  annularSectorPath,
  layoutPlate,
  polarToCartesian,
  type MacroKey,
  type PlateInput,
} from './arc';

export interface DayPlateSegment {
  id: string;
  /** Shown in the middle when this segment is selected, e.g. "Breakfast". */
  label: string;
  nutrients: Nutrients;
}

export interface DayPlateProps {
  segments: readonly DayPlateSegment[];
  /**
   * A full turn represents this many kilocalories, so how far the ring has
   * travelled reads as progress through the day's target. Pass null when the
   * user has set no target: the ring then shows composition only and fills
   * completely, which is why the caption changes with it.
   */
  targetKcal: number | null;
  /** Outer diameter in points. */
  size?: number;
  /** Fired when a segment is selected or cleared, for haptics. */
  onSelect?: (segment: DayPlateSegment | null) => void;
  style?: StyleProp<ViewStyle>;
}

const MACRO_ORDER: readonly MacroKey[] = ['protein', 'carbs', 'fat'];

function energyParts(nutrients: Nutrients) {
  return {
    protein: nutrients.proteinG * KCAL_PER_GRAM.protein,
    carbs: nutrients.carbsG * KCAL_PER_GRAM.carbs,
    fat: nutrients.fatG * KCAL_PER_GRAM.fat,
  };
}

/**
 * The day, as one dial.
 *
 * This is the app's signature figure, and it is a chart rather than an
 * ornament: it answers three questions in one glance that would otherwise
 * take three separate widgets.
 *
 *   **How far through the day am I?** The ring's travel is the day's share of
 *   its energy target. A full turn is the target, so a half-filled dial means
 *   half the target. With no target set there is nothing to be half of, so
 *   the ring fills completely and only composition is claimed.
 *
 *   **How did the day break up?** Each meal is one arc, sized by its energy,
 *   with a gap either side. Four arcs means four meals.
 *
 *   **What was it made of?** Inside each arc, protein, carb and fat bands are
 *   sized by the energy each macro supplied - so the colour of the ring is
 *   the shape of the diet, not a decorative tint.
 *
 * Tapping an arc moves the middle figure onto that meal, which is how the
 * chart stays readable as the day fills up: the whole is in the middle, and
 * any part is one tap away. Nothing here invents precision - the arcs are
 * drawn from the same stored numbers the list below shows, and a meal with no
 * macro data draws as a plain arc rather than a guessed split.
 */
export function DayPlate({
  segments,
  targetKcal,
  size = 224,
  onSelect,
  style,
}: DayPlateProps) {
  const theme = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A slim band. A thick one reads as a toy; this leaves the middle open for
  // the figure, which is what the eye should land on first.
  const thickness = Math.round(size * 0.095);
  const outerRadius = size / 2;
  const innerRadius = outerRadius - thickness;
  const midRadius = outerRadius - thickness / 2;

  // A selected arc grows outward, so it needs room inside the canvas.
  const lift = 5;
  const padding = lift + 4;
  const canvas = size + padding * 2;
  const cx = canvas / 2;

  const inputs = useMemo<PlateInput[]>(
    () =>
      segments.map((segment) => ({
        id: segment.id,
        value: segment.nutrients.caloriesKcal,
        parts: energyParts(segment.nutrients),
      })),
    [segments],
  );

  const totalKcal = segments.reduce(
    (sum, segment) => sum + segment.nutrients.caloriesKcal,
    0,
  );

  const hasTarget = targetKcal !== null && targetKcal > 0;
  const isOverTarget = hasTarget && totalKcal > targetKcal;

  /**
   * What a full turn is worth.
   *
   * Up to the target, a full turn is the target, so the ring's travel is
   * progress. Once the day goes past it the dial rescales to the day itself:
   * the ring comes round to full and a tick marks where the target fell.
   * Rescaling rather than overlaying a second lap keeps every meal at a
   * readable size and leaves exactly one thing on the dial to interpret.
   */
  const fullValue = isOverTarget ? totalKcal : targetKcal;

  const layout = useMemo(
    () =>
      layoutPlate(inputs, {
        ...(fullValue !== null && fullValue > 0 ? { fullValue } : {}),
        // Wide enough that four meals read as four, not as a dotted line.
        gapDegrees: segments.length > 1 ? 5 : 0,
        minSliceDegrees: 5,
      }),
    [inputs, fullValue, segments.length],
  );

  const selected = selectedId
    ? (segments.find((segment) => segment.id === selectedId) ?? null)
    : null;

  const macroColor: Record<MacroKey, string> = {
    protein: theme.colors.protein,
    carbs: theme.colors.carbs,
    fat: theme.colors.fat,
  };

  const handlePress = (segment: DayPlateSegment) => {
    const next = selectedId === segment.id ? null : segment.id;
    setSelectedId(next);
    onSelect?.(next === null ? null : segment);
  };

  // What the middle reads. Selecting an arc narrows it to that meal.
  const shownKcal = Math.round(selected?.nutrients.caloriesKcal ?? totalKcal);
  const shownLabel = selected
    ? selected.label
    : hasTarget
      ? `of ${Math.round(targetKcal)} kcal`
      : 'kcal today';

  const summary = useMemo(() => {
    if (segments.length === 0) return 'Nothing logged yet today.';
    const meals = segments
      .map(
        (segment) =>
          `${segment.label}, ${Math.round(segment.nutrients.caloriesKcal)} kilocalories`,
      )
      .join('; ');
    const progress =
      hasTarget
        ? ` That is ${Math.round((totalKcal / targetKcal) * 100)} per cent of a ${Math.round(targetKcal)} kilocalorie target.`
        : '';
    return `${Math.round(totalKcal)} kilocalories logged today across ${segments.length} ${segments.length === 1 ? 'meal' : 'meals'}: ${meals}.${progress}`;
  }, [segments, targetKcal, totalKcal, hasTarget]);

  return (
    <View
      style={[{ width: canvas, height: canvas, alignSelf: 'center' }, style]}
      accessible={!onSelect}
      accessibilityRole="image"
      accessibilityLabel={summary}
    >
      <Svg width={canvas} height={canvas}>
        {/* The unfilled remainder of the target, so the gap is legible. */}
        <Circle
          cx={cx}
          cy={cx}
          r={midRadius}
          stroke={theme.colors.surfaceAlt}
          strokeWidth={thickness}
          fill="none"
        />

        {layout.slices.map((slice) => {
          const isSelected = slice.id === selectedId;
          const segment = segments.find((candidate) => candidate.id === slice.id);
          const sliceOuter = outerRadius + (isSelected ? lift : 0);
          const sliceInner = innerRadius + (isSelected ? lift * 0.4 : 0);

          const bands =
            slice.bands.length > 0
              ? slice.bands
              : // No macro data: draw the arc in a neutral tone rather than
                // inventing a split that was never measured.
                [{ key: null, startAngle: slice.startAngle, endAngle: slice.endAngle }];

          return (
            <G key={slice.id}>
              {bands.map((band, index) => (
                <Path
                  key={`${slice.id}-${band.key ?? 'unknown'}-${index}`}
                  d={annularSectorPath({
                    cx,
                    cy: cx,
                    innerRadius: sliceInner,
                    outerRadius: sliceOuter,
                    startAngle: band.startAngle,
                    endAngle: band.endAngle,
                  })}
                  fill={band.key ? macroColor[band.key] : theme.colors.textSubtle}
                  // Selecting one meal pushes the rest well back rather than
                  // half-fading them, which only turns warm colours pastel.
                  opacity={selectedId !== null && !isSelected ? 0.22 : 1}
                  onPress={segment ? () => handlePress(segment) : undefined}
                  // One accessible node per meal, not one per band: a screen
                  // reader should offer "Breakfast", not three slivers of it.
                  accessible={Boolean(onSelect) && index === 0}
                  accessibilityLabel={
                    segment && index === 0
                      ? `${segment.label}, ${Math.round(segment.nutrients.caloriesKcal)} kilocalories`
                      : undefined
                  }
                />
              ))}
            </G>
          );
        })}

        {/*
          Where the target fell, once the day has gone past it, so the
          overshoot is the arc beyond the mark - an amount you can see rather
          than a badge saying you went over.

          Two strokes, because one is not enough to tell apart from the gaps
          between meals: a notch cut through the band in the track colour,
          and a short ink tick continuing outside the ring. The tick is what
          distinguishes a marker from a gap, and it sits on the page rather
          than on the band, so it never has to fight a macro colour.
        */}
        {isOverTarget && targetKcal !== null ? (
          (() => {
            const angle = (targetKcal / totalKcal) * 360;
            const notchFrom = polarToCartesian(cx, cx, innerRadius - 1, angle);
            const notchTo = polarToCartesian(cx, cx, outerRadius + 1, angle);
            const tickFrom = polarToCartesian(cx, cx, outerRadius + 1, angle);
            const tickTo = polarToCartesian(cx, cx, outerRadius + lift + 1, angle);
            return (
              <G>
                <Line
                  x1={notchFrom.x}
                  y1={notchFrom.y}
                  x2={notchTo.x}
                  y2={notchTo.y}
                  stroke={theme.colors.surfaceAlt}
                  strokeWidth={5}
                />
                <Line
                  x1={tickFrom.x}
                  y1={tickFrom.y}
                  x2={tickTo.x}
                  y2={tickTo.y}
                  stroke={theme.colors.text}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              </G>
            );
          })()
        ) : null}
      </Svg>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: padding + thickness,
          right: padding + thickness,
          top: padding + thickness,
          bottom: padding + thickness,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="metricXL" numberOfLines={1} adjustsFontSizeToFit>
          {segments.length === 0 ? '0' : String(shownKcal)}
        </Text>
        <Text variant="footnote" color="textMuted" align="center" numberOfLines={2}>
          {shownLabel}
        </Text>
      </View>
    </View>
  );
}

/** The macro key order the plate draws in, for a matching legend. */
export { MACRO_ORDER };
