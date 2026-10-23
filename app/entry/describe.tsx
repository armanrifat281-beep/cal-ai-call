import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, TextInput, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import {
  ErrorState,
  PressableScale,
  Screen,
  Text,
} from '@/components/ui';
import {
  DEFAULT_GRAMS,
  foodPhrases,
  getSearchAvailability,
  recordToEntryItem,
  searchFoods,
} from '@/features/foods';
import { bumpJournalRevision, useJournalRepository } from '@/features/journal';
import { mealTypeForHour } from '@/features/journal/MealEditor';
import { computeEntryTotals } from '@/features/nutrition';
import { saveMealPhoto } from '@/features/photos';
import { formatTimeOfDay } from '@/lib/date';
import type { AppError } from '@/lib/result';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import {
  MEAL_TYPE_LABELS,
  type FoodEntryItem,
  type MealType,
} from '@/types/domain';

/** How long the typing has to stop before anything is looked up. */
const LOOKUP_DEBOUNCE_MS = 700;

interface Found {
  /** The user's own words, which is what the chip shows. */
  phrase: string;
  /** Null while the lookup is in flight, and when nothing matched. */
  item: FoodEntryItem | null;
  state: 'looking' | 'found' | 'missing';
}

/**
 * Describe a meal in words, and let the database do the rest.
 *
 * The third way in, beside the camera and the search box, and the one that
 * fits how people actually remember a meal: not as a list of foods with
 * weights, but as a sentence. "Scrambled eggs with a salad and a splash of
 * olive oil" is a thing somebody can type in ten seconds; finding four
 * database records for it by hand is a two-minute job nobody does twice.
 *
 * What happens to the sentence is deliberately plain, and the screen shows
 * its working. It is split on commas and "and", the filler words are
 * stripped, and each phrase that remains is looked up in the same nutrition
 * database the search screen uses. There is no model here reading the
 * sentence and no figure invented from it: every chip below the box names
 * the record it matched, anything wrong comes off with one tap, and a
 * phrase nothing matched says so rather than guessing.
 *
 * The sentence itself is kept as the meal's note, so the thing the user
 * actually remembers survives even where the lookup did not.
 */
export default function DescribeMealScreen() {
  const theme = useTheme();
  const router = useRouter();
  const repository = useJournalRepository();
  const params = useLocalSearchParams<{ photoUri?: string; mealType?: string }>();
  const retainPhotos = usePreferencesStore((state) => state.preferences.retainPhotos);

  const [text, setText] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  /*
    When it was eaten, and it is editable.

    The common case for this screen is writing down a meal some time after
    eating it - that is the whole reason for typing rather than
    photographing - so the time at the top is a control, not a stamp. The
    meal type follows from it rather than being asked for separately: nobody
    wants a segmented control to tell the app that 9 am was breakfast.
  */
  const [consumedAt, setConsumedAt] = useState(() => new Date());
  const [pickingTime, setPickingTime] = useState(false);

  const availability = getSearchAvailability();

  const mealType: MealType = useMemo(
    () => mealTypeForHour(consumedAt.getHours()),
    [consumedAt],
  );

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Android fires a dismiss event; iOS keeps the inline picker mounted.
    if (Platform.OS === 'android') setPickingTime(false);
    if (event.type === 'dismissed' || !selected) return;
    setConsumedAt(selected);
  };

  /*
    Only the newest lookup is allowed to write to the screen.

    Typing produces a run of overlapping searches, and the network does not
    return them in order. Without this, pausing mid-sentence and then
    finishing it could leave the chips showing the half-sentence's results.
  */
  const runId = useRef(0);

  const phrases = useMemo(() => foodPhrases(text), [text]);
  const phraseKey = phrases.join('|');

  useEffect(() => {
    // Nothing to look up. The results for the previous sentence are not
    // cleared here - `shown` below drops anything whose phrase is no longer
    // in the text, which keeps this effect to the one job it has.
    if (!availability.available || phrases.length === 0) return;

    const run = ++runId.current;
    const timer = setTimeout(() => {
      void (async () => {
        setFound(
          phrases.map((phrase) => ({ phrase, item: null, state: 'looking' as const })),
        );

        const results = await Promise.all(
          phrases.map(async (phrase): Promise<Found> => {
            const result = await searchFoods(phrase);
            if (!result.ok || result.value.length === 0) {
              return { phrase, item: null, state: 'missing' };
            }
            // The first match, at the amount the record is quoted in. The
            // portion is the one thing the sentence rarely says, so it opens
            // at 100 g and is corrected on the meal itself.
            return {
              phrase,
              item: recordToEntryItem(result.value[0]!, DEFAULT_GRAMS),
              state: 'found',
            };
          }),
        );

        if (run === runId.current) setFound(results);
      })();
    }, LOOKUP_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `phraseKey` rather than `phrases`: a new array every render would
    // restart the timer on every keystroke even when nothing changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phraseKey, availability.available]);

  /*
    Only the chips the sentence still asks for.

    Derived rather than cleared from the effect: deleting the text used to
    leave the old chips on screen until the next lookup came back, and
    clearing them from inside the effect made every keystroke cascade a
    second render.
  */
  const shown = found.filter((entry) => phrases.includes(entry.phrase));

  const items = shown
    .map((entry) => entry.item)
    .filter((item): item is FoodEntryItem => item !== null);

  const totals = computeEntryTotals({ items });
  const looking = shown.some((entry) => entry.state === 'looking');

  const remove = useCallback((phrase: string) => {
    setFound((current) => current.filter((entry) => entry.phrase !== phrase));
  }, []);

  const title = useMemo(() => {
    const names = items.map((item) => item.name);
    if (names.length === 0) return text.trim().slice(0, 60) || 'Meal';
    if (names.length <= 2) return names.join(' and ');
    return `${names[0]} and ${names.length - 1} more`;
    // `items` is rebuilt every render from `found`; keying on its length and
    // the text is what actually changes the title.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, items[0]?.name, text]);

  const save = async () => {
    if (items.length === 0) return;

    setSaving(true);
    setError(null);

    const result = await repository.createEntry({
      consumedAt: consumedAt.toISOString(),
      mealType,
      title,
      items,
      // The sentence is kept whatever the lookup made of it: it is the only
      // record of what was actually eaten, and the user wrote it.
      notes: text.trim() || null,
    });

    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return;
    }

    if (params.photoUri && retainPhotos) {
      await saveMealPhoto(result.value.id, params.photoUri);
    }

    setSaving(false);
    bumpJournalRevision();
    router.replace(`/entry/${result.value.id}`);
  };

  return (
    <Screen
      edges={{ top: true, bottom: true }}
      contentStyle={{ gap: theme.spacing.lg }}
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <InputButton
            icon="camera"
            label="Photograph it instead"
            onPress={() => router.replace('/(tabs)/scan')}
          />
          <InputButton
            icon="gallery"
            label="Choose a photo"
            onPress={() => {
              void (async () => {
                const picked = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  quality: 1,
                  allowsEditing: false,
                  exif: false,
                });
                const asset = picked.canceled ? null : picked.assets[0];
                if (asset) {
                  router.replace({
                    pathname: '/entry/new',
                    params: { photoUri: asset.uri },
                  });
                }
              })();
            }}
          />
          <InputButton
            icon="search"
            label="Search the database"
            onPress={() => router.replace('/foods/search')}
          />

          <PressableScale
            onPress={() => void save()}
            disabled={items.length === 0 || saving}
            haptic
            accessibilityRole="button"
            accessibilityLabel="Log this meal"
            accessibilityState={{ disabled: items.length === 0 || saving }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 15,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primary,
              opacity: items.length === 0 || saving ? 0.45 : 1,
            }}
          >
            <Text
              variant="headline"
              color={theme.colors.textOnPrimary}
              style={{ fontWeight: '700' }}
            >
              {saving ? 'Saving…' : 'Log food'}
            </Text>
          </PressableScale>
        </View>
      }
    >
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

        <Text variant="headline">Log your meal</Text>

        {/*
          The time, as a control. It carries a chevron because it opens
          something, and because a bare timestamp in a header is the kind of
          thing people stare at wondering why their 9 am breakfast was filed
          as an afternoon snack.
        */}
        <PressableScale
          onPress={() => setPickingTime((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={`Eaten at ${formatTimeOfDay(consumedAt.toISOString())}. Change the time`}
          scaleTo={0.95}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text variant="caption" color="textSubtle">
            {formatTimeOfDay(consumedAt.toISOString())}
          </Text>
          <Icon
            name={pickingTime ? 'chevronUp' : 'chevronDown'}
            size={13}
            color="textSubtle"
            strokeWidth={2}
          />
        </PressableScale>
      </View>

      {pickingTime ? (
        <DateTimePicker
          value={consumedAt}
          mode="time"
          onChange={onPickerChange}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          // The picker follows the operating system unless told otherwise,
          // so an app in dark mode on a light phone got a light picker.
          themeVariant={theme.scheme}
          accentColor={theme.colors.primary}
        />
      ) : null}

      {error ? <ErrorState message={error.message} detail={error.detail} /> : null}

      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        placeholder="I had scrambled eggs with a fresh salad on the side, some cherry tomatoes, and a splash of olive oil"
        placeholderTextColor={theme.colors.textSubtle}
        accessibilityLabel="Describe what you ate"
        style={{
          minHeight: 132,
          textAlignVertical: 'top',
          fontSize: 17,
          lineHeight: 25,
          color: theme.colors.text,
        }}
      />

      {!availability.available ? (
        <Text variant="caption" color="textSubtle">
          {availability.reason}
        </Text>
      ) : phrases.length === 0 ? (
        <Text variant="caption" color="textSubtle">
          Separate the foods with commas or the word “and”, and each one gets
          looked up in the nutrition database.
        </Text>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text variant="label" color="textMuted">
              Recognised so far
            </Text>
            {looking ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
          </View>

          {/*
            A row, not a wrapped block. Each food is a tile wide enough for
            its name, which keeps the list to one line of reading however
            long the sentence was - and the whole row scrolls rather than
            pushing the running total off the screen.
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.md, paddingVertical: 2 }}
          >
            {shown.map((entry) => (
              <FoundTile key={entry.phrase} found={entry} onRemove={() => remove(entry.phrase)} />
            ))}
          </ScrollView>

          {items.length > 0 ? (
            <Text variant="callout" color="textMuted">
              Looks like {MEAL_TYPE_LABELS[mealType].toLowerCase()}, about{' '}
              <Text variant="callout" color="text" style={{ fontWeight: '700' }}>
                {Math.round(totals.nutrients.caloriesKcal).toLocaleString()} kcal
              </Text>{' '}
              · each food at {DEFAULT_GRAMS} g, which you can correct after
              logging.
            </Text>
          ) : looking ? null : (
            <Text variant="callout" color="textMuted">
              Nothing in the database matched yet. Try naming the foods more
              plainly — “chicken breast” rather than “the chicken I made”.
            </Text>
          )}
        </View>
      )}
    </Screen>
  );
}

/**
 * One food the sentence was matched to.
 *
 * A round tile with the name under it and a cross on its shoulder. The
 * important part is the NAME: it is the database record the phrase matched,
 * not the phrase itself, so "a splash of olive oil" shows as "Olive oil"
 * and anything the lookup got wrong is obvious at a glance rather than
 * discovered later in the day's totals.
 *
 * The whole tile removes it. A cross small enough to look right on the
 * corner is too small to aim at, so the badge is decoration over a target
 * the size of the tile.
 */
function FoundTile({ found, onRemove }: { found: Found; onRemove: () => void }) {
  const theme = useTheme();

  const label = found.state === 'found' ? found.item!.name : found.phrase;
  const kcal =
    found.state === 'found'
      ? Math.round(found.item!.nutrients.caloriesKcal)
      : null;

  return (
    <PressableScale
      onPress={onRemove}
      haptic
      accessibilityRole="button"
      accessibilityLabel={
        found.state === 'found'
          ? `${label}, ${kcal} kilocalories. Remove it`
          : found.state === 'looking'
            ? `Looking up ${label}`
            : `${label}, nothing matched. Remove it`
      }
      scaleTo={0.94}
      style={{ width: 76, alignItems: 'center', gap: 6 }}
    >
      <View>
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              found.state === 'found'
                ? theme.colors.primarySoft
                : theme.colors.surfaceAlt,
          }}
        >
          {found.state === 'looking' ? (
            <ActivityIndicator size="small" color={theme.colors.textSubtle} />
          ) : (
            <Icon
              name={found.state === 'found' ? 'leaf' : 'search'}
              size={20}
              color={found.state === 'found' ? 'primary' : 'textSubtle'}
              strokeWidth={1.7}
            />
          )}
        </View>

        {found.state === 'looking' ? null : (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surfaceAlt,
              // A ring in the page colour, so the badge reads as sitting on
              // top of the tile rather than cut out of it.
              borderWidth: 2,
              borderColor: theme.colors.background,
            }}
            pointerEvents="none"
          >
            <Icon name="close" size={10} color="textMuted" strokeWidth={2.6} />
          </View>
        )}
      </View>

      <View style={{ alignItems: 'center', gap: 1 }}>
        <Text
          variant="caption"
          color={found.state === 'found' ? 'text' : 'textSubtle'}
          numberOfLines={2}
          align="center"
          style={{ fontWeight: '600', fontSize: 11, lineHeight: 14 }}
        >
          {label}
        </Text>
        {kcal === null ? (
          <Text variant="caption" color="textSubtle" style={{ fontSize: 10 }}>
            {found.state === 'missing' ? 'no match' : ''}
          </Text>
        ) : (
          <Text variant="caption" color="textSubtle" style={{ fontSize: 10 }}>
            {kcal} kcal
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

function InputButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.9}
      style={{
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
      }}
    >
      <Icon name={icon} size={19} color="textMuted" strokeWidth={1.8} />
    </PressableScale>
  );
}
