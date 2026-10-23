import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  ConfidenceBar,
  DayDashboard,
  DayOverviewSkeleton,
  MacroSplitCard,
  OtherNutrients,
  QuickActions,
  WeekStrip,
} from '@/components/nutrition';
import {
  Appear,
  Avatar,
  Collapsible,
  ErrorState,
  Row,
  Screen,
  Surface,
  Text,
} from '@/components/ui';
import { useDayAndWeek } from '@/features/journal';
import { WaterCard } from '@/features/water';
import { WeightCard } from '@/features/weight';
import { maintenanceKcal, summarizeConfidence } from '@/features/nutrition';
import { todayKey } from '@/lib/date';
import { env } from '@/lib/env';
import { greetingFor } from '@/lib/greeting';
import { useAvatarStore } from '@/features/profile';
import { hasEnoughForInsights } from '@/features/memory/insights';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

/**
 * Home.
 *
 * The day's figure, then the three ways to add to it, then the two cards
 * that qualify it. That order is deliberate: the question someone opens a
 * calorie app to ask is "am I alright today", and the thing they do next is
 * "let me log what I just ate" - everything else on this screen is reading
 * material and sits below both.
 *
 * Today's meals are NOT here. They have their own tab, where the day can be
 * changed and a meal can be edited; home used to carry a copy of the list
 * which could only ever show today and could not be scrolled past.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const dateKey = todayKey();

  const targets = usePreferencesStore((state) => state.preferences.dailyTargets);
  const bodyBasics = usePreferencesStore((state) => state.preferences.bodyBasics);
  const displayName = usePreferencesStore((state) => state.preferences.displayName);
  const avatarUri = useAvatarStore((state) => state.uri);

  // One read for the day and the week it sits in: the week's range already
  // contains the day, and two reads could disagree about it after a save.
  const { entries, summary, week, loading, error, reload } = useDayAndWeek(dateKey);
  const confidence = useMemo(() => summarizeConfidence(entries), [entries]);

  /*
    Only offer Insights once it has something to say.

    The row promised "patterns counted from your saved meals" from the very
    first launch and led to "Not enough logged yet", which reads as a broken
    feature rather than as one that has not started yet. The week strip is
    already loaded, so this costs no extra read.
  */
  const insightsReady = useMemo(
    () =>
      hasEnoughForInsights(
        week.reduce((sum, day) => sum + day.entryCount, 0),
        week.filter((day) => day.entryCount > 0).length,
      ),
    [week],
  );

  /**
   * What the body has spent so far today.
   *
   * Resting energy times how much the user says they move, prorated by how
   * much of the day has gone. This app tracks no exercise and is not
   * connected to a watch, so this is an estimate of ordinary living and
   * nothing more - which is exactly why it is derived from the user's own
   * height, weight, age and activity rather than from a constant, and why
   * it is null until those are known.
   */
  const burnedKcal = useMemo(() => {
    const perDay = maintenanceKcal(bodyBasics);
    if (perDay === null) return null;

    const now = new Date();
    const elapsed =
      (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
    return perDay * elapsed;
  }, [bodyBasics]);

  const refresh = useCallback(() => reload(), [reload]);

  const now = new Date();
  const greeting = greetingFor(now.getHours(), displayName);
  const dateLine = now
    .toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();

  return (
    <Screen
      edges={{ top: true }}
      refreshing={loading}
      onRefresh={refresh}
      contentStyle={{ gap: theme.spacing.base }}
    >
      {/*
        The header is written out here rather than handed to `Screen`'s
        title: the date belongs ABOVE the greeting, as an eyebrow, and the
        avatar has to sit on the greeting's own line.
      */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.xs,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="caption" color="textSubtle" style={{ letterSpacing: 1.1 }}>
            {dateLine}
          </Text>
          <Text variant="display" numberOfLines={1}>
            {greeting}
          </Text>
        </View>

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
      ) : loading && entries.length === 0 ? (
        <DayOverviewSkeleton />
      ) : (
        /*
          Shown on a first run too.

          An earlier version hid the dial until something was logged, on the
          grounds that a ring reading 0 of 2,000 is the screen saying "you
          have done nothing". That reasoning was wrong in practice: the dial
          is the app's one signature element, and without it home is a
          greeting and a large empty space. An empty ring against a target is
          also simply the truth about the day so far.
        */
        <Appear index={0}>
          <DayDashboard
            summary={summary}
            targets={targets}
            dayLabel="Today"
            burnedKcal={burnedKcal}
            onSetTarget={() => router.push('/settings/targets')}
            onSetBurn={() => router.push('/settings/targets')}
          />
        </Appear>
      )}

      <Appear index={1}>
        <QuickActions
          onScan={() => router.push('/(tabs)/scan')}
          onSearch={() => router.push('/foods/search')}
          onManual={() => router.push('/entry/describe')}
        />
      </Appear>

      {/* Two halves of one row: the shape of the day beside the one thing
          on this screen that is not food. */}
      <Appear index={2}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <MacroSplitCard
            totals={summary.totals.nutrients}
            // Omitting the handler hides the button, so this leads nowhere
            // empty either. It was the fourth way into Insights and the
            // least obvious: "View details" does not read as "Insights".
            onViewDetails={
              insightsReady ? () => router.push('/(tabs)/insights') : undefined
            }
          />
          <WaterCard />
        </View>
      </Appear>

      {/* The shape of the habit, under the day it belongs to. */}
      <Appear index={3}>
        <WeekStrip
          days={week}
          selectedKey={dateKey}
          onSelect={() => router.push('/(tabs)/meals')}
          targetKcal={targets.caloriesKcal}
        />
      </Appear>

      <Appear index={4}>
        <WeightCard />
      </Appear>

      {/*
        The qualifying detail, folded away. How much of today is measured
        rather than estimated, and the nutrients under the headline four,
        are both worth having and neither is urgent.
      */}
      <Appear index={5}>
        <Collapsible
          title="More about today"
          summary={
            // Null when nothing is logged: a share of nothing is not 0%.
            confidence.measuredShare === null
              ? 'Fibre, sugar, saturated fat and sodium'
              : `${Math.round(confidence.measuredShare * 100)}% of today measured · fibre, sugar, saturated fat and sodium`
          }
        >
          <View style={{ gap: theme.blockGap }}>
            <ConfidenceBar confidence={confidence} />
            <OtherNutrients
              totals={summary.totals.nutrients}
              incompleteKeys={summary.totals.incompleteKeys}
            />
          </View>
        </Collapsible>
      </Appear>

      <Appear index={6}>
        <Surface variant="grouped">
          {/*
            Discover makes something new - every chip on it opens the recipe
            creator - so it takes the sparkle. The library of recipes the
            user already has takes `recipes`, which is the icon that screen
            uses for itself. Two adjacent rows sharing one glyph is what
            made them hard to tell apart.
          */}
          <Row
            title="Discover recipes"
            subtitle="What to cook from what you already have"
            leading={<Icon name="sparkle" size={19} color="primary" />}
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            onPress={() => router.push('/(tabs)/discover')}
          />
          <Row
            title="Your recipes"
            subtitle="Saved, favourites and the ones you have cooked"
            leading={<Icon name="recipes" size={19} color="primary" />}
            trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
            divided
            onPress={() => router.push('/(tabs)/recipes')}
          />
          {insightsReady ? (
            <Row
              title="Insights"
              subtitle="Patterns counted from your saved meals"
              leading={<Icon name="insights" size={19} color="primary" />}
              trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
              divided
              onPress={() => router.push('/(tabs)/insights')}
            />
          ) : null}
        </Surface>
      </Appear>

      {!env.isSupabaseConfigured ? (
        <Text variant="caption" color="textSubtle">
          No account backend is configured in this build, so your meals are
          stored on this device and are not backed up. These are your real
          saved entries, not sample data.
        </Text>
      ) : null}
    </Screen>
  );
}
