import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ProgressRing } from '@/components/charts';
import { AnimatedNumber, PressableScale, Text } from '@/components/ui';
import type { DaySummary } from '@/features/nutrition';
import { useTheme, type ColorKey } from '@/theme';
import type { DailyTargets } from '@/types/domain';

export interface DayDashboardProps {
  summary: DaySummary;
  targets: DailyTargets;
  /** The eyebrow, e.g. "Today". Read out, not drawn: the card has a title row above it. */
  dayLabel: string;
  /**
   * Resting energy spent so far today, estimated from the user's own height,
   * weight, age and activity. Null when those are not known, which is the
   * only honest thing to show: this app tracks no exercise, so a burn figure
   * it cannot derive is a number it would be making up.
   */
  burnedKcal?: number | null;
  /** Offered when no target is set, which is what makes the ring possible. */
  onSetTarget?: () => void;
  /** Opens the body details, from which `burnedKcal` is worked out. */
  onSetBurn?: () => void;
}

interface MacroSpec {
  key: ColorKey & ('protein' | 'carbs' | 'fat');
  label: string;
  eaten: number;
  target: number | null;
}

/**
 * The day, at a glance. The first thing on Home and the largest thing in the
 * app.
 *
 * One card, not four. The ring IS the card, with the day's three plain
 * figures stacked beside it and the macros as a row of small tiles beneath -
 * a hierarchy rather than a grid of equals.
 *
 * It leads with what is LEFT rather than what was eaten. "1,250 eaten" is a
 * fact about the past; "1,250 left" is the thing a decision about dinner
 * actually turns on. Past the target it switches to "over", because a
 * negative number of calories left is not a thing anyone reads correctly.
 *
 * With no target there is no ring - a ring against nothing is a circle - so
 * it shows the plain total and the one control that fixes that.
 */
export function DayDashboard({
  summary,
  targets,
  dayLabel,
  burnedKcal = null,
  onSetTarget,
  onSetBurn,
}: DayDashboardProps) {
  const theme = useTheme();

  const nutrients = summary.totals.nutrients;
  const eaten = nutrients.caloriesKcal;
  const target = targets.caloriesKcal;
  const remaining = target === null ? null : Math.round(target - eaten);
  const over = remaining !== null && remaining < 0;

  const macros: MacroSpec[] = [
    { key: 'protein', label: 'Protein', eaten: nutrients.proteinG, target: targets.proteinG },
    { key: 'carbs', label: 'Carbs', eaten: nutrients.carbsG, target: targets.carbsG },
    { key: 'fat', label: 'Fat', eaten: nutrients.fatG, target: targets.fatG },
  ];

  return (
    <View
      // Named for the day it describes. On Home that is always today, but
      // the same card draws a past day in the journal, where "Eaten 1,269"
      // read out with no date is a figure about nothing.
      accessibilityLabel={dayLabel}
      style={{
        borderRadius: 26,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.base,
        gap: theme.spacing.base,
        overflow: 'hidden',
      }}
    >
      {/*
        A wash of the accent behind the ring.

        The card is otherwise the same near-black as everything else on the
        page, and the one figure the whole screen exists for would sit in it
        unannounced. The glow is what makes the dial read as lit rather than
        printed. Absolutely positioned and non-interactive, so it cannot
        affect layout or swallow a touch.
      */}
      <Svg
        style={{ position: 'absolute', top: 0, left: 0 }}
        width={240}
        height={240}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="dayGlow" cx="35%" cy="38%" r="62%">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.22} />
            <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={240} height={240} fill="url(#dayGlow)" />
      </Svg>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.base }}>
        {target === null ? (
          <NoTargetDial eaten={eaten} onSetTarget={onSetTarget} />
        ) : (
          <ProgressRing
            progress={target > 0 ? eaten / target : 0}
            size={146}
            thickness={13}
            color={over ? theme.colors.warning : theme.colors.primary}
            accessibilityLabel={
              over
                ? `${Math.abs(remaining ?? 0)} kilocalories over your ${target} target`
                : `${remaining} kilocalories left of ${target}`
            }
          >
            <View style={{ alignItems: 'center', gap: 2 }}>
              <AnimatedNumber
                value={Math.abs(remaining ?? 0)}
                variant="metricXL"
                style={{ fontSize: 38, lineHeight: 42 }}
              />
              <Text
                variant="caption"
                color="textSubtle"
                style={{ textTransform: 'uppercase', letterSpacing: 1 }}
              >
                {over ? 'kcal over' : 'kcal left'}
              </Text>
            </View>
          </ProgressRing>
        )}

        {/*
          The day's three plain figures, stacked. Divided by hairlines rather
          than boxed: they are one list of facts about one day, and three
          outlined tiles here would compete with the macros below, which are
          genuinely three separate things.
        */}
        <View style={{ flex: 1 }}>
          <DayStat label="Eaten" value={Math.round(eaten).toLocaleString()} />
          <DayStat
            label="Burned"
            value={burnedKcal === null ? null : Math.round(burnedKcal).toLocaleString()}
            emptyHint="Add your details"
            onPress={onSetBurn}
            divided
          />
          <DayStat
            label="Fibre"
            value={nutrients.fiberG === null ? null : `${Math.round(nutrients.fiberG)} g`}
            emptyHint="Not known"
            divided
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {macros.map((macro) => (
          <MacroTile key={macro.key} macro={macro} />
        ))}
      </View>
    </View>
  );
}

/** One figure in the stack beside the ring. */
function DayStat({
  label,
  value,
  emptyHint,
  onPress,
  divided = false,
}: {
  label: string;
  value: string | null;
  emptyHint?: string;
  onPress?: () => void;
  divided?: boolean;
}) {
  const theme = useTheme();

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // A floor under the gap, not just space-between. With a long value
        // like "Add your details" the two ends met in the middle and read
        // as one word.
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        borderTopWidth: divided ? theme.hairline : 0,
        borderTopColor: theme.colors.separator,
      }}
    >
      <Text variant="callout" color="textMuted">
        {label}
      </Text>
      {value === null ? (
        <Text
          variant="caption"
          color={onPress ? 'primary' : 'textSubtle'}
          align="right"
          style={{ flexShrink: 1 }}
        >
          {emptyHint ?? '—'}
        </Text>
      ) : (
        <Text variant="metricL" style={{ fontSize: 22 }}>
          {value}
        </Text>
      )}
    </View>
  );

  if (!onPress || value !== null) return body;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${emptyHint ?? 'not known'}`}
      scaleTo={0.99}
    >
      {body}
    </PressableScale>
  );
}

/**
 * One macro: a dot in its own colour, the figure, and how far through the
 * target it is.
 *
 * Outlined rather than filled. These sit directly on the card the ring is
 * on, and a third fill level between the page, the card and the tile is one
 * more step than the eye can tell apart on a black screen.
 */
function MacroTile({ macro }: { macro: MacroSpec }) {
  const theme = useTheme();
  const color = theme.colors[macro.key];
  const ratio =
    macro.target !== null && macro.target > 0
      ? Math.min(1, macro.eaten / macro.target)
      : null;

  return (
    <View
      style={{
        flex: 1,
        borderRadius: theme.radius.media,
        borderWidth: theme.hairline,
        borderColor: theme.colors.border,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
        <Text variant="caption" color="textMuted">
          {macro.label}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text variant="metricL" style={{ fontSize: 20 }}>
          {Math.round(macro.eaten)}
        </Text>
        <Text variant="caption" color="textSubtle">
          {macro.target === null ? 'g' : `/ ${Math.round(macro.target)}g`}
        </Text>
      </View>

      {/* The track is drawn even with no target, so the three tiles keep the
          same height whether or not goals have been set. */}
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        {ratio === null ? null : (
          <View
            style={{
              width: `${Math.round(ratio * 100)}%`,
              height: '100%',
              borderRadius: 2,
              backgroundColor: color,
            }}
          />
        )}
      </View>
    </View>
  );
}

/** What stands in for the dial before any goal exists. */
function NoTargetDial({
  eaten,
  onSetTarget,
}: {
  eaten: number;
  onSetTarget?: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ width: 146, alignItems: 'center', gap: theme.spacing.sm }}>
      <AnimatedNumber
        value={Math.round(eaten)}
        variant="metricXL"
        style={{ fontSize: 38, lineHeight: 42 }}
      />
      <Text
        variant="caption"
        color="textSubtle"
        align="center"
        style={{ textTransform: 'uppercase', letterSpacing: 1 }}
      >
        kcal eaten today
      </Text>

      {onSetTarget ? (
        <PressableScale
          onPress={onSetTarget}
          haptic
          accessibilityRole="button"
          style={{
            marginTop: 2,
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary,
          }}
        >
          <Text
            variant="caption"
            color={theme.colors.textOnPrimary}
            style={{ fontWeight: '700' }}
          >
            Set a daily target
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
