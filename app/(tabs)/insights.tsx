import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Disclosure,
  EmptyState,
  ErrorState,
  Screen,
  Section,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import { LOCAL_USER_ID, useRangeJournal } from '@/features/journal';
import { generateInsights } from '@/features/memory/insights';
import { addDaysToKey, formatDayLabel, todayKey } from '@/lib/date';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

type Period = '7' | '30';

const PERIOD_OPTIONS = [
  { value: '7' as const, label: '7 days' },
  { value: '30' as const, label: '30 days' },
];

/**
 * Insights.
 *
 * Each insight is a headline and a sentence, with "how this was counted" one
 * tap away. Every one is computed from stored entries and names the entries
 * it used - that was true before and still is; what changed is that it no
 * longer takes an outlined card and a badge per insight to say so.
 */
export default function InsightsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('7');

  const foodMemoryEnabled = usePreferencesStore(
    (state) => state.preferences.foodMemoryEnabled,
  );

  const endKey = todayKey();
  const startKey = addDaysToKey(endKey, period === '7' ? -6 : -29);
  const { entries, loading, error, reload } = useRangeJournal(startKey, endKey);

  const { insights, sufficiency } = useMemo(
    () => generateInsights(entries, LOCAL_USER_ID, { periodStart: startKey, periodEnd: endKey }),
    [entries, startKey, endKey],
  );

  if (!foodMemoryEnabled) {
    return (
      <Screen title="Insights" edges={{ top: true }}>
        <EmptyState
          title="Food Memory is off"
          body="Insights are built from your saved meal history. Your meals are still being saved; they are just not being analysed."
          illustration={<Icon name="sparkle" size={38} color="textMuted" strokeWidth={1.5} />}
          actionLabel="Turn it on in Profile"
          onAction={() => router.push('/(tabs)/profile')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Insights"
      subtitle="Counted from the meals you saved. Nothing here is guessed."
      edges={{ top: true }}
      refreshing={loading}
      onRefresh={reload}
    >
      <SegmentedControl
        options={PERIOD_OPTIONS}
        value={period}
        onChange={setPeriod}
        accessibilityLabel="Insight period"
      />

      <Text variant="footnote" color="textSubtle">
        {formatDayLabel(startKey)} to {formatDayLabel(endKey)}
      </Text>

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? reload : undefined}
        />
      ) : loading && entries.length === 0 ? (
        <View style={{ gap: theme.blockGap }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Skeleton width="65%" height={24} />
            <Skeleton height={36} />
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            <Skeleton width="50%" height={24} />
            <Skeleton height={36} />
          </View>
        </View>
      ) : !sufficiency.sufficient ? (
        <EmptyState
          title="Not enough logged yet"
          body={`${sufficiency.requirement} So far this period has ${
            sufficiency.entryCount
          } meal${sufficiency.entryCount === 1 ? '' : 's'} across ${
            sufficiency.daysLogged
          } day${sufficiency.daysLogged === 1 ? '' : 's'}.`}
          illustration={<Icon name="insights" size={38} color="primary" strokeWidth={1.5} />}
          actionLabel="Add a meal"
          onAction={() => router.push('/entry/new')}
        />
      ) : (
        insights.map((insight) => (
          <Section key={insight.id} dense>
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="title1">{insight.headline}</Text>
              <Text variant="body" color="textMuted">
                {insight.detail}
              </Text>
              <Disclosure
                summary={`From ${insight.evidence.entryCount} saved meal${
                  insight.evidence.entryCount === 1 ? '' : 's'
                }`}
                detail={insight.evidence.method}
              />
            </View>
          </Section>
        ))
      )}
    </Screen>
  );
}
