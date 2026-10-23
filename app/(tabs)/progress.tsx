import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { ProgressRing } from '@/components/charts';
import { Icon } from '@/components/Icon';
import {
  Appear,
  Avatar,
  ErrorState,
  PressableScale,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useDayJournal, useRangeJournal } from '@/features/journal';
import {
  SCORE_BAND_LABELS,
  computeEntryTotals,
  scoreDay,
  scoreEntry,
} from '@/features/nutrition';
import { WeightCard } from '@/features/weight';
import { addDaysToKey, formatTimeOfDay, groupByDateKey, todayKey } from '@/lib/date';
import { useAvatarStore } from '@/features/profile';
import { hasEnoughForInsights } from '@/features/memory/insights';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme, type ColorKey } from '@/theme';
import type { FoodEntry } from '@/types/domain';

/** How far back the streak is allowed to run. Longer than anyone's habit. */
const STREAK_WINDOW_DAYS = 120;

/**
 * Progress.
 *
 * The day scored, the day's meals scored, and the one number in the app that
 * is not about food. Everything on this screen is arithmetic over the user's
 * own entries - there is no coach behind it and nothing is fetched - which
 * is why the notes under the score name the figure they came from rather
 * than giving advice.
 *
 * The score is `features/nutrition/score.ts`, which is a page of documented
 * thresholds. Anyone who disagrees with a number here can read exactly which
 * line produced it.
 */
export default function ProgressScreen() {
  const theme = useTheme();
  const router = useRouter();
  const dateKey = todayKey();

  const targets = usePreferencesStore((state) => state.preferences.dailyTargets);
  const displayName = usePreferencesStore((state) => state.preferences.displayName);
  const avatarUri = useAvatarStore((state) => state.uri);

  const { entries, summary, loading, error, reload } = useDayJournal(dateKey);
  const history = useRangeJournal(addDaysToKey(dateKey, -STREAK_WINDOW_DAYS), dateKey);

  const score = useMemo(() => scoreDay(entries), [entries]);
  const streak = useMemo(
    () => countStreak(history.entries, dateKey),
    [history.entries, dateKey],
  );

  // Same reasoning as Home: do not offer Insights before it can answer.
  const insightsReady = useMemo(
    () =>
      hasEnoughForInsights(
        history.entries.length,
        groupByDateKey(history.entries, (entry) => entry.consumedAt).size,
      ),
    [history.entries],
  );

  const nutrients = summary.totals.nutrients;

  const rings: {
    tone: ColorKey;
    label: string;
    eaten: number;
    target: number | null;
    unit: string;
  }[] = [
    {
      tone: 'primary',
      label: 'Calories',
      eaten: nutrients.caloriesKcal,
      target: targets.caloriesKcal,
      unit: 'kcal',
    },
    {
      tone: 'fiber',
      label: 'Fibre',
      eaten: nutrients.fiberG ?? 0,
      // Not a goal the user sets, so it is held against the figure every
      // public guideline agrees on rather than against nothing.
      target: 30,
      unit: 'g',
    },
    {
      tone: 'protein',
      label: 'Protein',
      eaten: nutrients.proteinG,
      target: targets.proteinG,
      unit: 'g',
    },
  ];

  return (
    <Screen
      edges={{ top: true }}
      refreshing={loading}
      onRefresh={reload}
      contentStyle={{ gap: theme.spacing.lg }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <StreakBadge days={streak} />
        <Avatar
          name={displayName}
          imageUri={avatarUri}
          onPress={() => router.push('/(tabs)/profile')}
        />
      </View>

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? reload : undefined}
        />
      ) : null}

      <Appear index={0}>
        <View style={{ gap: theme.spacing.xs }}>
          {/*
            No score yet is a sentence, not a dash.

            An em dash set at 58pt is a grey bar the width of a word, which
            reads as something still loading rather than as "you have not
            logged anything".
          */}
          {score.value === null ? (
            <Text variant="title1" color="textMuted">
              No score yet today
            </Text>
          ) : (
            <Text variant="metricXL" color="primary" style={{ fontSize: 58, lineHeight: 62 }}>
              {score.value.toFixed(1)}
            </Text>
          )}

          <Text variant="callout" color="textMuted">
            Daily score ·{' '}
            {score.value === null
              ? 'log a meal and it is worked out from what is in it'
              : SCORE_BAND_LABELS[score.band].toLowerCase()}
          </Text>
        </View>
      </Appear>

      <Appear index={1}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {rings.map((ring) => (
            <TargetRing key={ring.label} {...ring} />
          ))}
        </View>
      </Appear>

      <Appear index={2}>
        <TodayNotes
          entries={entries}
          kcalEaten={nutrients.caloriesKcal}
          kcalTarget={targets.caloriesKcal}
          proteinEaten={nutrients.proteinG}
          proteinTarget={targets.proteinG}
          onAct={() => router.push('/(tabs)/meals')}
        />
      </Appear>

      <Appear index={3}>
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="title2">Food journal</Text>

          {loading && entries.length === 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Skeleton height={54} />
              <Skeleton height={54} />
            </View>
          ) : entries.length === 0 ? (
            <Text variant="callout" color="textSubtle">
              Nothing logged today. Every meal you save gets a score here, with
              the reasons behind it.
            </Text>
          ) : (
            <View style={{ gap: theme.spacing.xs }}>
              {entries.map((entry) => (
                <ScoredEntryRow
                  key={entry.id}
                  entry={entry}
                  onPress={() => router.push(`/entry/${entry.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </Appear>

      <Appear index={4}>
        <WeightCard />
      </Appear>

      {insightsReady ? (
        <Appear index={5}>
          <PressableScale
            onPress={() => router.push('/(tabs)/insights')}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              padding: theme.spacing.base,
              borderRadius: 20,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Icon name="insights" size={19} color="primary" />
            <View style={{ flex: 1 }}>
              <Text variant="headline" style={{ fontSize: 15 }}>
                Insights
              </Text>
              <Text variant="caption" color="textSubtle">
                Patterns counted across weeks, not just today
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color="textSubtle" />
          </PressableScale>
        </Appear>
      ) : null}
    </Screen>
  );
}

/** Days in a row, ending today, with at least one meal saved. */
export function countStreak(entries: readonly FoodEntry[], endKey: string): number {
  const byDay = groupByDateKey(entries, (entry) => entry.consumedAt);

  let streak = 0;
  let key = endKey;

  /*
    Today not being logged yet does not break a run.

    Counting from today would mean the streak read 0 every morning until
    breakfast was saved, which is both wrong and the most discouraging
    possible moment to say it. So an empty today is skipped once; an empty
    yesterday ends the count.
  */
  if ((byDay.get(key)?.length ?? 0) === 0) {
    key = addDaysToKey(key, -1);
  }

  while ((byDay.get(key)?.length ?? 0) > 0) {
    streak += 1;
    key = addDaysToKey(key, -1);
  }

  return streak;
}

function StreakBadge({ days }: { days: number }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 8,
        paddingHorizontal: 13,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surface,
      }}
      accessibilityLabel={
        days === 0
          ? 'No streak yet'
          : `${days} day${days === 1 ? '' : 's'} logged in a row`
      }
    >
      <Icon name="flame" size={15} color="accent" strokeWidth={1.8} />
      <Text variant="metricS">{days}</Text>
      <Text variant="caption" color="textSubtle">
        day{days === 1 ? '' : 's'}
      </Text>
    </View>
  );
}

function TargetRing({
  tone,
  label,
  eaten,
  target,
  unit,
}: {
  tone: ColorKey;
  label: string;
  eaten: number;
  target: number | null;
  unit: string;
}) {
  const theme = useTheme();
  const ratio = target !== null && target > 0 ? eaten / target : null;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.base,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
      }}
    >
      <ProgressRing
        progress={ratio ?? 0}
        size={62}
        thickness={6}
        color={theme.colors[tone]}
        accessibilityLabel={
          ratio === null
            ? `${label}: no target set`
            : `${label}: ${Math.round(ratio * 100)} percent of target`
        }
      >
        <Text variant="metricS" style={{ fontSize: 12 }}>
          {ratio === null ? '—' : `${Math.round(ratio * 100)}%`}
        </Text>
      </ProgressRing>

      <View style={{ alignItems: 'center', gap: 1 }}>
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
        <Text variant="metricS">
          {Math.round(eaten).toLocaleString()} {unit}
        </Text>
      </View>
    </View>
  );
}

/**
 * What is worth saying about today, counted rather than advised.
 *
 * Each line names the figure it came from. There is no model here and no
 * coach: a sentence this screen cannot derive from the user's own entries is
 * a sentence it does not print.
 */
function TodayNotes({
  entries,
  kcalEaten,
  kcalTarget,
  proteinEaten,
  proteinTarget,
  onAct,
}: {
  entries: readonly FoodEntry[];
  kcalEaten: number;
  kcalTarget: number | null;
  proteinEaten: number;
  proteinTarget: number | null;
  onAct: () => void;
}) {
  const theme = useTheme();

  const notes: string[] = [];

  if (kcalTarget !== null) {
    const left = Math.round(kcalTarget - kcalEaten);
    if (left > 150) notes.push(`${left.toLocaleString()} kcal still to go today.`);
    else if (left < -100) notes.push(`${Math.abs(left).toLocaleString()} kcal over your target.`);
    else notes.push('Today has landed close to your calorie target.');
  }

  if (proteinTarget !== null) {
    const short = Math.round(proteinTarget - proteinEaten);
    if (short > 15) notes.push(`${short} g short on protein.`);
  }

  const lowest = [...entries]
    .map((entry) => ({ entry, score: scoreEntry(entry) }))
    .filter((pair) => pair.score.value !== null)
    .sort((a, b) => (a.score.value ?? 0) - (b.score.value ?? 0))[0];

  if (lowest && (lowest.score.value ?? 10) < 4.5) {
    notes.push(
      `${lowest.entry.title} scored ${lowest.score.value?.toFixed(1)} — open it to see why.`,
    );
  }

  if (notes.length === 0) return null;

  return (
    <View
      style={{
        borderRadius: 20,
        backgroundColor: theme.colors.primarySoft,
        padding: theme.spacing.base,
        gap: theme.spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="sparkle" size={15} color="primary" />
        <Text variant="label" color="primaryOnSoft">
          Today so far
        </Text>
      </View>

      {notes.map((note) => (
        <Text key={note} variant="callout" color="text">
          {note}
        </Text>
      ))}

      <Text
        variant="footnote"
        color="primary"
        style={{ fontWeight: '700', marginTop: 2 }}
        onPress={onAct}
        accessibilityRole="button"
      >
        Open today&apos;s meals
      </Text>
    </View>
  );
}

function ScoredEntryRow({ entry, onPress }: { entry: FoodEntry; onPress: () => void }) {
  const theme = useTheme();
  const score = scoreEntry(entry);
  const kcal = Math.round(computeEntryTotals(entry).nutrients.caloriesKcal);

  const tone: ColorKey =
    score.band === 'excellent' || score.band === 'good'
      ? 'primary'
      : score.band === 'fair'
        ? 'warning'
        : score.band === 'poor'
          ? 'danger'
          : 'textSubtle';

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, scored ${score.value ?? 'not yet'}`}
      scaleTo={0.99}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
      }}
    >
      <Text
        variant="metricM"
        color={tone}
        style={{ width: 34, fontSize: 16 }}
      >
        {score.value === null ? '—' : score.value.toFixed(1)}
      </Text>

      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="headline" numberOfLines={1} style={{ fontSize: 15 }}>
          {entry.title}
        </Text>
        <Text variant="caption" color="textSubtle">
          {kcal.toLocaleString()} kcal · {entry.items.length} item
          {entry.items.length === 1 ? '' : 's'}
        </Text>
      </View>

      <Text variant="caption" color="textSubtle">
        {formatTimeOfDay(entry.consumedAt)}
      </Text>
    </PressableScale>
  );
}
