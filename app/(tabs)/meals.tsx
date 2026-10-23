import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { MealEntryRow } from '@/components/nutrition';
import {
  Appear,
  ErrorState,
  PressableScale,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { bumpJournalRevision, useDayJournal, useJournalRepository } from '@/features/journal';
import { computeEntryTotals, reportionItem } from '@/features/nutrition';
import { addDaysToKey, todayKey } from '@/lib/date';
import { useTheme } from '@/theme';
import { MEAL_TYPES, MEAL_TYPE_LABELS, type FoodEntry, type MealType } from '@/types/domain';

/** Which day the list is showing, relative to today. */
type DayChoice = -1 | 0 | 1;

const DAY_LABELS: Record<DayChoice, string> = {
  [-1]: 'Yesterday',
  0: 'Today',
  1: 'Tomorrow',
};

/**
 * The day's meals.
 *
 * Its own tab rather than a block on Home, because this is the screen people
 * come back to: it is where a wrong portion gets corrected, where a meal
 * gets opened, and where "did I log lunch" is answered. Home carries the
 * day's totals; this carries the day itself.
 *
 * Three days, not a calendar. Yesterday covers the overwhelmingly common
 * case - logging last night's dinner this morning - and tomorrow exists so a
 * meal can be planned rather than only recorded. Anything further back is in
 * History, which is a list rather than a stepper.
 *
 * Each meal type gets a section whether or not it has anything in it. A
 * missing dinner is information; a list that silently omits it is not.
 */
export default function MealsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [choice, setChoice] = useState<DayChoice>(0);
  const dateKey = useMemo(() => addDaysToKey(todayKey(), choice), [choice]);

  const { entries, summary, loading, error, reload } = useDayJournal(dateKey);
  const repository = useJournalRepository();
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);

  const byMealType = useMemo(() => {
    const groups = new Map<MealType, FoodEntry[]>();
    for (const mealType of MEAL_TYPES) groups.set(mealType, []);
    for (const entry of entries) groups.get(entry.mealType)?.push(entry);
    return groups;
  }, [entries]);

  /**
   * Re-portion a one-item meal in place.
   *
   * Written here rather than in the row so the row stays a drawing: it has
   * no repository, no revision bump and nothing to undo. A rescale that
   * cannot be done - an item whose original portion never resolved to a
   * weight - sends the user to the record, which can ask for the missing
   * weight. Silently doing nothing on a press is the one outcome a stepper
   * must never have.
   */
  const changeServings = useCallback(
    async (entry: FoodEntry, quantity: number) => {
      const item = entry.items[0];
      if (!item) return;

      const outcome = reportionItem(item, { ...item.portion, quantity });
      if (outcome.status !== 'ok') {
        router.push(`/entry/${entry.id}`);
        return;
      }

      setBusyEntryId(entry.id);
      const result = await repository.updateEntry(entry.id, { items: [outcome.item] });
      setBusyEntryId(null);

      if (result.ok) {
        // Every mounted screen re-reads: the day's totals on Home are now
        // wrong by exactly the amount that just changed.
        bumpJournalRevision();
      }
    },
    [repository, router],
  );

  const dayTotal = Math.round(summary.totals.nutrients.caloriesKcal);

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
        <View style={{ flex: 1 }}>
          <Text variant="display" numberOfLines={1}>
            {choice === 0 ? "Today's meals" : `${DAY_LABELS[choice]}'s meals`}
          </Text>
        </View>

        <PressableScale
          onPress={() => router.push('/entry/new')}
          haptic
          accessibilityRole="button"
          accessibilityLabel="Add a meal"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 9,
            paddingHorizontal: 15,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary,
          }}
        >
          <Icon name="plus" size={14} color={theme.colors.textOnPrimary} strokeWidth={2.6} />
          <Text
            variant="caption"
            color={theme.colors.textOnPrimary}
            style={{ fontWeight: '700' }}
          >
            Add
          </Text>
        </PressableScale>
      </View>

      {/*
        Three days as one control. A segmented control rather than arrows
        either side of a date: the two days anyone actually wants are
        yesterday and today, and with arrows both of those are a guess at
        which direction the app counts in.
      */}
      <View
        style={{
          flexDirection: 'row',
          padding: 4,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surface,
        }}
      >
        {([-1, 0, 1] as DayChoice[]).map((option) => {
          const selected = option === choice;
          return (
            <PressableScale
              key={option}
              onPress={() => setChoice(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={DAY_LABELS[option]}
              scaleTo={0.98}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 10,
                borderRadius: theme.radius.pill,
                backgroundColor: selected ? theme.colors.surfaceAlt : 'transparent',
              }}
            >
              <Text
                variant="callout"
                color={selected ? 'text' : 'textSubtle'}
                style={{ fontWeight: selected ? '700' : '500' }}
              >
                {DAY_LABELS[option]}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? reload : undefined}
        />
      ) : null}

      {loading && entries.length === 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <Skeleton height={86} />
          <Skeleton height={86} />
          <Skeleton height={86} />
        </View>
      ) : (
        MEAL_TYPES.map((mealType, index) => (
          <Appear key={mealType} index={index}>
            <MealSection
              mealType={mealType}
              entries={byMealType.get(mealType) ?? []}
              busyEntryId={busyEntryId}
              onOpen={(entry) => router.push(`/entry/${entry.id}`)}
              onChangeServings={(entry, quantity) => void changeServings(entry, quantity)}
              onAdd={() => router.push(`/entry/new?mealType=${mealType}`)}
            />
          </Appear>
        ))
      )}

      {entries.length > 0 ? (
        <Text variant="caption" color="textSubtle" align="center">
          {entries.length} meal{entries.length === 1 ? '' : 's'} ·{' '}
          {dayTotal.toLocaleString()} kcal
        </Text>
      ) : null}

      {/*
        The way to a day more than one step from today.

        This screen stops at yesterday and tomorrow, which covers what
        anyone logs in practice - but the journal is the only screen that
        can reach last week, and without a door here it would be reachable
        from nowhere at all.
      */}
      <PressableScale
        onPress={() => router.push('/(tabs)/journal')}
        accessibilityRole="button"
        accessibilityLabel="History"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.base,
          borderRadius: 20,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Icon name="clock" size={19} color="primary" strokeWidth={1.8} />
        <View style={{ flex: 1 }}>
          <Text variant="headline" style={{ fontSize: 15 }}>
            History
          </Text>
          <Text variant="caption" color="textSubtle">
            Any earlier day, and everything saved in it
          </Text>
        </View>
        <Icon name="chevronRight" size={16} color="textSubtle" />
      </PressableScale>
    </Screen>
  );
}

function MealSection({
  mealType,
  entries,
  busyEntryId,
  onOpen,
  onChangeServings,
  onAdd,
}: {
  mealType: MealType;
  entries: FoodEntry[];
  busyEntryId: string | null;
  onOpen: (entry: FoodEntry) => void;
  onChangeServings: (entry: FoodEntry, quantity: number) => void;
  onAdd: () => void;
}) {
  const theme = useTheme();

  const kcal = entries.reduce(
    (sum, entry) => sum + computeEntryTotals(entry).nutrients.caloriesKcal,
    0,
  );

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* A dot per meal, in the accent. It is the only thing telling
              four identical headings apart at a glance. */}
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: theme.colors.primary,
            }}
          />
          <Text variant="title2">{MEAL_TYPE_LABELS[mealType]}</Text>
        </View>

        <Text variant="callout" color="textSubtle">
          {Math.round(kcal).toLocaleString()} kcal
        </Text>
      </View>

      {entries.length === 0 ? (
        <PressableScale
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={`Add something to ${MEAL_TYPE_LABELS[mealType].toLowerCase()}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.base,
            borderRadius: 20,
            backgroundColor: theme.colors.surface,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surfaceAlt,
            }}
          >
            <Icon name="plus" size={17} color="textMuted" strokeWidth={2.2} />
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline" style={{ fontSize: 15 }}>
              Nothing logged yet
            </Text>
            <Text variant="caption" color="textSubtle">
              Scan it, search for it, or write it down
            </Text>
          </View>
        </PressableScale>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {entries.map((entry) => (
            <MealEntryRow
              key={entry.id}
              entry={entry}
              busy={busyEntryId === entry.id}
              onPress={() => onOpen(entry)}
              onChangeServings={(quantity) => onChangeServings(entry, quantity)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
