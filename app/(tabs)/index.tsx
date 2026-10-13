import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  ConfidenceBar,
  DayOverview,
  DayOverviewSkeleton,
  MealRow,
  OtherNutrients,
  QuickActions,
  WeekStrip,
} from '@/components/nutrition';
import {
  Appear,
  Disclosure,
  EmptyState,
  ErrorState,
  Row,
  Screen,
  Section,
  Skeleton,
  Surface,
} from '@/components/ui';
import { useDayAndWeek, useRecentEntries } from '@/features/journal';
import { WaterCard } from '@/features/water';
import { WeightCard } from '@/features/weight';
import { summarizeConfidence } from '@/features/nutrition';
import { formatDayLabel, todayKey } from '@/lib/date';
import { env } from '@/lib/env';
import { greetingFor } from '@/lib/greeting';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

/**
 * Home.
 *
 * The week, then the three ways to log a meal, then the day's figure, then
 * the day itself. That order is deliberate: the two things a returning user
 * wants are "am I keeping this up" and "let me add what I just ate", and
 * both used to be below the fold or absent. Scanning in particular could not
 * be started from this screen at all - it needed a trip to another tab -
 * while adding a meal by hand moved between two places depending on whether
 * the day was empty.
 *
 * On a first run the dial is held back. A ring reading 0 of 2,000 above an
 * empty list is the whole screen saying "you have done nothing", which is a
 * poor first impression and tells the user nothing they did not know.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const dateKey = todayKey();

  const targets = usePreferencesStore((state) => state.preferences.dailyTargets);
  // One read for the day and the week it sits in: the week's range already
  // contains the day, and two reads could disagree about it after a save.
  const { entries, summary, week, loading, error, reload } = useDayAndWeek(dateKey);
  const recent = useRecentEntries(4);
  const confidence = useMemo(() => summarizeConfidence(entries), [entries]);

  const refreshAll = useCallback(() => {
    reload();
    recent.reload();
  }, [reload, recent]);

  // Yesterday and earlier, so "log again" is a genuine shortcut rather than a
  // second copy of the list already on screen.
  const earlier = recent.entries.filter(
    (entry) => !entries.some((today) => today.id === entry.id),
  );

  // Nothing logged, ever - not merely nothing yet today.
  const firstRun =
    !loading && entries.length === 0 && recent.entries.length === 0;

  const dayLabel = formatDayLabel(dateKey);
  const displayName = usePreferencesStore((state) => state.preferences.displayName);
  const greeting = greetingFor(new Date().getHours(), displayName);

  return (
    <Screen
      title={greeting}
      subtitle={`${dayLabel} · ${new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}`}
      edges={{ top: true }}
      refreshing={loading}
      onRefresh={refreshAll}
    >
      {/* The shape of the habit, before any number. */}
      <Appear index={0}>
        <WeekStrip
          days={week}
          selectedKey={dateKey}
          onSelect={() => router.push('/(tabs)/journal')}
          targetKcal={targets.caloriesKcal}
        />
      </Appear>

      <Appear index={1}>
        <QuickActions
          onScan={() => router.push('/(tabs)/scan')}
          onSearch={() => router.push('/foods/search')}
          onManual={() => router.push('/entry/new')}
        />
      </Appear>

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
          greeting, a row of buttons and a large empty space - which reads
          as unfinished rather than tactful. An empty ring against a target
          is also simply the truth about the day so far.
        */
        <Appear index={2}>
          <DayOverview summary={summary} targets={targets} dayLabel={dayLabel} />
        </Appear>
      )}

      {/* The app's whole argument, in one strip: which of today's calories
          are measured and which are guesses. Directly under the dial, so it
          qualifies the number it belongs to. */}
      <Appear index={3}>
        <ConfidenceBar confidence={confidence} />
      </Appear>

      <Appear index={4}>
        <WaterCard />
      </Appear>

      {/* The one card worth looking at from the first day: it needs no
          logged meals, no backend and no API key. */}
      <Appear index={5}>
        <WeightCard />
      </Appear>

      {/* Fibre, sugar, saturated fat and sodium - stored on every item all
          along, and shown nowhere until now. */}
      <Appear index={6}>
        <OtherNutrients
          totals={summary.totals.nutrients}
          incompleteKeys={summary.totals.incompleteKeys}
        />
      </Appear>

      <Appear index={7}>
        <Section
          title="Meals"
          action={
            entries.length > 0
              ? { label: 'Add', onPress: () => router.push('/entry/new') }
              : undefined
          }
        >
          {loading && entries.length === 0 ? (
            <View style={{ gap: theme.spacing.base }}>
              <Skeleton height={44} />
              <Skeleton height={44} />
            </View>
          ) : entries.length === 0 ? (
            <EmptyState
              title={firstRun ? 'Log your first meal' : 'Nothing logged yet'}
              body={
                firstRun
                  ? 'Photograph it, look it up, or type it in. Every estimate shows where its numbers came from, and you can correct any of them.'
                  : 'Photograph your next meal, or add one by hand. Everything you save stays editable.'
              }
              illustration={
                <Icon name="leaf" size={38} color="primary" strokeWidth={1.5} />
              }
            />
          ) : (
            <View>
              {entries.map((entry, index) => (
                <MealRow
                  key={entry.id}
                  entry={entry}
                  divided={index > 0}
                  onPress={() => router.push(`/entry/${entry.id}`)}
                />
              ))}
            </View>
          )}
        </Section>
      </Appear>

      {earlier.length > 0 ? (
        <Appear index={8}>
          <Section
            title="Log again"
            subtitle="Meals you saved earlier. Open one to add it to today."
          >
            <Surface variant="grouped">
              {earlier.map((entry, index) => (
                <Row
                  key={entry.id}
                  title={entry.title}
                  subtitle={formatDayLabel(
                    new Date(entry.consumedAt).toISOString().slice(0, 10),
                  )}
                  divided={index > 0}
                  trailing={
                    <Icon name="chevronRight" size={16} color="textSubtle" />
                  }
                  onPress={() => router.push(`/entry/${entry.id}`)}
                />
              ))}
            </Surface>
          </Section>
        </Appear>
      ) : null}

      {/* Nothing saved means nothing to count, and the insights screen can
          only answer "not enough logged yet". Offering a route whose single
          possible reply is a refusal is worse than not offering it. */}
      {firstRun ? null : (
        <Appear index={9}>
          <Surface variant="grouped">
            <Row
              title="Insights"
              subtitle="Patterns counted from your saved meals"
              leading={<Icon name="insights" size={19} color="primary" />}
              trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
              onPress={() => router.push('/(tabs)/insights')}
            />
          </Surface>
        </Appear>
      )}

      {!env.isSupabaseConfigured ? (
        <Disclosure
          summary="Saved on this device only"
          detail="No account backend is configured in this build, so your meals are stored locally and are not backed up. These are your real saved entries, not sample data."
        />
      ) : null}
    </Screen>
  );
}
