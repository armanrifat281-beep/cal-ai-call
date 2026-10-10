import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { DayOverview, DayOverviewSkeleton, MealRow } from '@/components/nutrition';
import {
  Disclosure,
  EmptyState,
  ErrorState,
  Row,
  Screen,
  Section,
  Skeleton,
  Surface,
} from '@/components/ui';
import { useDayJournal, useRecentEntries } from '@/features/journal';
import { formatDayLabel, todayKey } from '@/lib/date';
import { env } from '@/lib/env';
import { greetingFor } from '@/lib/greeting';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

/**
 * Home.
 *
 * One hero figure, then the day as a timeline, then two quiet ways out.
 * Scanning is a tab now, so this screen no longer repeats a giant scan
 * block - it offers the two things you cannot reach in one tap from the tab
 * bar: adding a meal by hand, and re-logging something from earlier.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const dateKey = todayKey();

  const targets = usePreferencesStore((state) => state.preferences.dailyTargets);
  const { entries, summary, loading, error, reload } = useDayJournal(dateKey);
  const recent = useRecentEntries(4);

  const refreshAll = useCallback(() => {
    reload();
    recent.reload();
  }, [reload, recent]);

  // Yesterday and earlier, so "log again" is a genuine shortcut rather than a
  // second copy of the list already on screen.
  const earlier = recent.entries.filter(
    (entry) => !entries.some((today) => today.id === entry.id),
  );

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
      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? reload : undefined}
        />
      ) : loading && entries.length === 0 ? (
        <DayOverviewSkeleton />
      ) : (
        <DayOverview summary={summary} targets={targets} dayLabel={dayLabel} />
      )}

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
            title="Nothing logged yet"
            body="Photograph your next meal from the Scan tab, or add one by hand. Everything you save stays editable."
            illustration={<Icon name="leaf" size={38} color="primary" strokeWidth={1.5} />}
            actionLabel="Add a meal"
            onAction={() => router.push('/entry/new')}
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

      {earlier.length > 0 ? (
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
                trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
                onPress={() => router.push(`/entry/${entry.id}`)}
              />
            ))}
          </Surface>
        </Section>
      ) : null}

      <Surface variant="grouped">
        <Row
          title="Insights"
          subtitle="Patterns counted from your saved meals"
          leading={<Icon name="insights" size={19} color="primary" />}
          trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
          onPress={() => router.push('/(tabs)/insights')}
        />
      </Surface>

      {!env.isSupabaseConfigured ? (
        <Disclosure
          summary="Saved on this device only"
          detail="No account backend is configured in this build, so your meals are stored locally and are not backed up. These are your real saved entries, not sample data."
        />
      ) : null}
    </Screen>
  );
}
