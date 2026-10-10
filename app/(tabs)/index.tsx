import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { DailySummaryCard, EntryRow } from '@/components/nutrition';
import {
  Card,
  EmptyState,
  ErrorState,
  InfoNote,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useDayJournal, useRecentEntries } from '@/features/journal';
import { formatDayLabel, todayKey } from '@/lib/date';
import { env } from '@/lib/env';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

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

  // Yesterday and earlier, so "recent" is a genuine re-entry shortcut rather
  // than a duplicate of the list already on screen.
  const earlierEntries = recent.entries.filter(
    (entry) => !entries.some((today) => today.id === entry.id),
  );

  return (
    <Screen
      edges={{ top: true }}
      refreshing={loading}
      onRefresh={refreshAll}
      contentStyle={{ gap: theme.spacing.lg }}
    >
      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="caption" color="textMuted">
          {formatDayLabel(dateKey).toUpperCase()}
        </Text>
        <Text variant="title">Your plate today</Text>
      </View>

      {!env.isSupabaseConfigured ? (
        <InfoNote
          title="Saved on this device only"
          body="No account backend is configured in this build, so your meals are stored locally and are not backed up. Nothing here is fake: these are your real saved entries."
          tone="neutral"
        />
      ) : null}

      <ScanAction onPress={() => router.push('/scan')} />

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? reload : undefined}
        />
      ) : loading && entries.length === 0 ? (
        <SummarySkeleton />
      ) : (
        <DailySummaryCard
          totals={summary.totals}
          targets={targets}
          containsEstimates={summary.containsEstimates}
          dayLabel={formatDayLabel(dateKey)}
        />
      )}

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="heading">Today&apos;s meals</Text>

        {loading && entries.length === 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Skeleton height={96} radius={theme.radius.lg} />
            <Skeleton height={96} radius={theme.radius.lg} />
          </View>
        ) : entries.length === 0 ? (
          <Card variant="soft" padding="none">
            <EmptyState
              title="Nothing logged yet"
              body="Take a photo of your next meal, or add one by hand. Everything you save stays editable."
              illustration={<Icon name="leaf" size={44} color="primary" />}
              actionLabel="Scan your first meal"
              onAction={() => router.push('/scan')}
              secondaryActionLabel="Add a meal manually"
              onSecondaryAction={() => router.push('/entry/new')}
            />
          </Card>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onPress={() => router.push(`/entry/${entry.id}`)}
              />
            ))}
          </View>
        )}
      </View>

      {earlierEntries.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xxs }}>
            <Text variant="heading">Log again</Text>
            <Text variant="bodySm" color="textMuted">
              Meals you saved earlier. Tap one to open it and log it to today.
            </Text>
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            {earlierEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                compact
                onPress={() => router.push(`/entry/${entry.id}`)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

/** The dashboard's primary action. Large, high contrast, impossible to miss. */
function ScanAction({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Scan a meal"
      accessibilityHint="Opens the camera to photograph your food"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.base,
        padding: theme.spacing.lg,
        borderRadius: theme.radius.xl,
        backgroundColor: pressed ? theme.colors.accentPressed : theme.colors.accent,
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.18)',
        }}
      >
        <Icon name="scan" size={26} color={theme.colors.textOnAccent} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="subheading" color="textOnAccent">
          Scan a meal
        </Text>
        <Text variant="bodySm" color={theme.colors.textOnAccent} style={{ opacity: 0.85 }}>
          Photo in, estimate out. Edit anything before saving.
        </Text>
      </View>
      <Icon name="chevronRight" size={22} color={theme.colors.textOnAccent} />
    </Pressable>
  );
}

function SummarySkeleton() {
  const theme = useTheme();
  return (
    <Card padding="lg" style={{ gap: theme.spacing.base }}>
      <Skeleton width="40%" height={14} />
      <Skeleton width="55%" height={34} />
      <Skeleton height={10} radius={5} />
      <Skeleton width="70%" height={12} />
    </Card>
  );
}
