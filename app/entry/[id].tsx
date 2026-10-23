import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { CharacteristicList, ScoreCard } from '@/components/nutrition';
import {
  ErrorState,
  PressableScale,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useJournalRepository } from '@/features/journal';
import {
  computeEntryTotals,
  dailyValueFor,
  describeEntry,
  scoreEntry,
  type DailyValueKey,
} from '@/features/nutrition';
import { deleteMealPhoto, mealPhotoUri } from '@/features/photos';
import { formatDayLabel, formatTimeOfDay, toDateKey, todayKey } from '@/lib/date';
import { ok, type AppError } from '@/lib/result';
import { useAsyncResult } from '@/lib/useAsyncResult';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme, type ColorKey } from '@/theme';
import {
  MEAL_TYPE_LABELS,
  type FoodEntry,
} from '@/types/domain';

/**
 * The record of one saved meal.
 *
 * A record, not a form. Opening a meal used to put the user straight into an
 * edit screen - every field live, the keyboard a tap away - which answered
 * "change this" before anyone had asked it, and never answered the question
 * people actually open a meal to ask: was that any good?
 *
 * So this reads. The photograph, what it was, what it cost, how it scored
 * and why. Editing is one button at the bottom, next to logging it again and
 * deleting it, and it opens the same editor as before.
 */
export default function EntryRecordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const repository = useJournalRepository();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<AppError | null>(null);

  const {
    data: entry,
    loading,
    error: loadError,
    reload: load,
  } = useAsyncResult<FoodEntry | null>(
    async () => (id ? repository.getEntry(id) : ok(null)),
    [id, repository],
  );

  // A read that succeeded and came back with nothing means the meal is gone,
  // which is a different screen from a read that failed.
  const notFound = !loading && loadError === null && entry === null;

  const remove = async () => {
    if (!entry) return;
    setBusy(true);
    const result = await repository.deleteEntry(entry.id);
    setBusy(false);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    // Deleting the meal deletes its picture: a photo with no entry to belong
    // to is just a file the user cannot see or remove.
    deleteMealPhoto(entry.id);
    router.back();
  };

  /*
    Deleting asks first, and it is the only action here that does.

    A meal is a few seconds of work to log and there is no undo once the row
    is gone, so the cost of a stray tap is small but real - and the control
    is a bare glyph in a bar, which is exactly the kind of thing a thumb
    finds by accident while scrolling.
  */
  const confirmRemove = () => {
    if (!entry) return;
    Alert.alert(
      'Delete this meal?',
      `${entry.title} will be removed from your journal, along with its photo. This cannot be undone.`,
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove() },
      ],
    );
  };

  const logAgain = async () => {
    if (!entry) return;
    setBusy(true);
    setActionError(null);
    const result = await repository.duplicateEntry(entry.id, {});
    setBusy(false);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    router.back();
  };

  if (loading) {
    return (
      <Screen contentStyle={{ gap: theme.spacing.base }}>
        <Skeleton height={190} radius={24} />
        <Skeleton height={28} />
        <Skeleton height={86} radius={20} />
        <Skeleton height={96} radius={20} />
      </Screen>
    );
  }

  if (notFound) {
    return (
      <Screen>
        <ErrorState
          title="Meal not found"
          message="This meal is no longer in your journal. It may have been deleted."
          onRetry={() => router.back()}
          retryLabel="Go back"
        />
      </Screen>
    );
  }

  if (loadError || !entry) {
    return (
      <Screen>
        <ErrorState
          message={loadError?.message ?? 'We could not open this meal.'}
          detail={loadError?.detail}
          onRetry={load}
        />
      </Screen>
    );
  }

  const totals = computeEntryTotals(entry).nutrients;
  const score = scoreEntry(entry);
  const characteristics = describeEntry(entry);
  const photoUri = mealPhotoUri(entry.id);
  const consumedAt = new Date(entry.consumedAt);
  const dayKey = toDateKey(consumedAt);
  const isToday = dayKey === todayKey();

  return (
    <>
      <Stack.Screen options={{ title: entry.title }} />

      <Screen edges={{ top: true }} contentStyle={{ gap: theme.spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <PressableScale
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            scaleTo={0.9}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surface,
            }}
          >
            <Icon name="close" size={16} color="text" strokeWidth={2} />
          </PressableScale>

          <Text variant="headline">Meal record</Text>

          <Text variant="caption" color="textSubtle">
            {isToday ? formatTimeOfDay(entry.consumedAt) : formatDayLabel(dayKey)}
          </Text>
        </View>

        {actionError ? (
          <ErrorState message={actionError.message} detail={actionError.detail} />
        ) : null}

        <View
          style={{
            height: 190,
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              accessibilityLabel={`Photo of ${entry.title}`}
            />
          ) : (
            <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
              <Icon name="camera" size={26} color="textSubtle" strokeWidth={1.5} />
              <Text variant="caption" color="textSubtle">
                No photo kept for this meal
              </Text>
            </View>
          )}
        </View>

        <View style={{ gap: 6 }}>
          <Text variant="title1">{entry.title}</Text>
          <Text variant="callout" color="textMuted">
            {MEAL_TYPE_LABELS[entry.mealType]} ·{' '}
            {Math.round(totals.caloriesKcal).toLocaleString()} kcal ·{' '}
            {entry.items.length} ingredient{entry.items.length === 1 ? '' : 's'}
          </Text>
        </View>

        <ScoreCard score={score} characteristics={characteristics} />

        {/*
          The four headline figures with a share of the day under each. The
          share is what makes "32 g of fat" mean something to somebody who
          does not already know what a day's fat looks like.
        */}
        <View
          style={{
            flexDirection: 'row',
            borderRadius: 20,
            backgroundColor: theme.colors.surface,
            paddingVertical: theme.spacing.base,
          }}
        >
          <NutrientColumn
            nutrientKey="caloriesKcal"
            label="Calories"
            amount={Math.round(totals.caloriesKcal).toLocaleString()}
            entry={entry}
          />
          <NutrientColumn
            nutrientKey="proteinG"
            label="Protein"
            amount={`${Math.round(totals.proteinG)} g`}
            tone="protein"
            entry={entry}
          />
          <NutrientColumn
            nutrientKey="fatG"
            label="Fat"
            amount={`${Math.round(totals.fatG)} g`}
            tone="fat"
            entry={entry}
          />
          <NutrientColumn
            nutrientKey="carbsG"
            label="Carbs"
            amount={`${Math.round(totals.carbsG)} g`}
            tone="carbs"
            entry={entry}
          />
        </View>

        {/*
          Always here, even when it has nothing to say.

          A meal entered by hand carries only calories and the three macros,
          and none of those crosses a threshold often enough to produce a
          line - so the section used to vanish, which reads as a feature that
          does not work rather than as a meal the app knows little about.
          Saying which figures are missing is also the only way anyone learns
          that scanning a meal gets them more.
        */}
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="title2">Characteristics</Text>

          {characteristics.length > 0 ? (
            <>
              <CharacteristicList characteristics={characteristics} />
              <Text variant="caption" color="textSubtle">
                Worked out from this meal&apos;s own nutrients, per 100 kcal. It
                is a description of the food, not advice about your diet.
              </Text>
            </>
          ) : (
            <Text variant="callout" color="textMuted">
              {score.known < 1
                ? 'Only some of this meal’s nutrients were recorded, so there is nothing to say about its fibre, sugar, saturated fat or salt. Scanned meals and foods looked up in the database carry all of them.'
                : 'Nothing about this meal stands out either way — it sits in the middle on protein, fibre, sugar, saturated fat and salt.'}
            </Text>
          )}
        </View>

        {entry.items.length > 0 ? (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="title2">What was in it</Text>
            <View
              style={{
                borderRadius: 20,
                backgroundColor: theme.colors.surface,
                paddingHorizontal: theme.spacing.base,
              }}
            >
              {entry.items.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.md,
                    paddingVertical: theme.spacing.md,
                    borderTopWidth: index > 0 ? theme.hairline : 0,
                    borderTopColor: theme.colors.separator,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="callout" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text variant="caption" color="textSubtle">
                      {item.portion.quantity} {item.portion.unit}
                      {item.gramsResolved === null
                        ? ''
                        : ` · ${Math.round(item.gramsResolved)} g`}
                    </Text>
                  </View>
                  <Text variant="metricS">
                    {Math.round(item.nutrients.caloriesKcal)} kcal
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {entry.notes ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="title2">Your note</Text>
            <Text variant="body" color="textMuted">
              {entry.notes}
            </Text>
          </View>
        ) : null}

        {/*
          The three things you can do to a meal, in one small bar.

          Left-aligned and icon-sized rather than three full-width buttons:
          this screen is for reading, and a stack of pills across the bottom
          of it made changing the meal look like the point of opening it.
          Delete is the one coloured thing in the bar, and the only one that
          asks before it acts.
        */}
        <View style={{ flexDirection: 'row' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surface,
              paddingHorizontal: 6,
            }}
          >
            <RecordAction
              icon="pencil"
              label="Edit this meal"
              disabled={busy}
              onPress={() => router.push(`/entry/edit?id=${entry.id}`)}
            />
            <BarDivider />
            <RecordAction
              icon="copy"
              label={isToday ? 'Log this meal again' : 'Log this meal today'}
              disabled={busy}
              onPress={() => void logAgain()}
            />
            <BarDivider />
            <RecordAction
              icon="trash"
              label="Delete this meal"
              tone="danger"
              disabled={busy}
              onPress={confirmRemove}
            />
          </View>
        </View>
      </Screen>
    </>
  );
}

function NutrientColumn({
  nutrientKey,
  label,
  amount,
  tone,
  entry,
}: {
  nutrientKey: DailyValueKey;
  label: string;
  amount: string;
  tone?: ColorKey;
  entry: FoodEntry;
}) {
  const targets = usePreferencesStore((state) => state.preferences.dailyTargets);
  const totals = computeEntryTotals(entry).nutrients;
  const { share, personal } = dailyValueFor(nutrientKey, totals, targets);

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text variant="metricM" color={tone ?? 'text'} style={{ fontSize: 17 }}>
        {amount}
      </Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="caption" color="textSubtle" style={{ fontSize: 10 }}>
        {share === null
          ? '—'
          : `${Math.round(share * 100)}% ${personal ? 'of goal' : 'DV'}`}
      </Text>
    </View>
  );
}

function BarDivider() {
  const theme = useTheme();
  return (
    <View
      style={{ width: theme.hairline, height: 22, backgroundColor: theme.colors.separator }}
    />
  );
}

function RecordAction({
  icon,
  label,
  tone,
  disabled,
  onPress,
}: {
  icon: 'pencil' | 'copy' | 'trash';
  /** Spoken, not drawn. The glyphs are standard enough to carry the bar. */
  label: string;
  tone?: 'danger';
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      scaleTo={0.9}
      style={{
        width: 52,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon
        name={icon}
        size={19}
        color={tone === 'danger' ? theme.colors.danger : theme.colors.text}
        strokeWidth={1.8}
      />
    </PressableScale>
  );
}
