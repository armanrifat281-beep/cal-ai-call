import { Image } from 'expo-image';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PressableScale, Text } from '@/components/ui';
import { computeEntryTotals, formatPortion } from '@/features/nutrition';
import { mealPhotoUri } from '@/features/photos';
import { useTheme, type ColorKey } from '@/theme';
import type { FoodEntry } from '@/types/domain';

export interface MealEntryRowProps {
  entry: FoodEntry;
  /** Opens the meal record. */
  onPress?: () => void;
  /**
   * Changes how much of this meal was eaten.
   *
   * Only offered for a one-item meal, where "2" means something a user can
   * check against the plate. For a meal of several foods there is no single
   * number to step, so the row sends them to the record to edit an item.
   */
  onChangeServings?: (quantity: number) => void;
  /** Disables the stepper while a change is being written. */
  busy?: boolean;
}

/**
 * One logged meal, as a card.
 *
 * Everything the user needs to decide "is that right" without opening it:
 * the photograph they took, what the app called it, how much of it, the
 * macros underneath, and the energy figure the day is counted in.
 *
 * The stepper is on the card rather than inside the record because
 * correcting the amount is overwhelmingly the most common edit - the
 * recogniser gets the food right and the portion approximately - and making
 * that a two-screen trip was the single biggest reason a day's figures were
 * left wrong.
 */
export function MealEntryRow({
  entry,
  onPress,
  onChangeServings,
  busy = false,
}: MealEntryRowProps) {
  const theme = useTheme();
  const totals = computeEntryTotals(entry);
  const nutrients = totals.nutrients;
  const photoUri = mealPhotoUri(entry.id);

  const single = entry.items.length === 1 ? entry.items[0]! : null;
  const grams = single?.gramsResolved ?? null;

  const subtitle =
    single === null
      ? `${entry.items.length} items`
      : [formatPortion(single.portion), grams === null ? null : `${Math.round(grams)} g`]
          .filter(Boolean)
          .join(' · ');

  const macros: { key: ColorKey; label: string }[] = [
    { key: 'protein', label: `${Math.round(nutrients.proteinG)}P` },
    { key: 'carbs', label: `${Math.round(nutrients.carbsG)}C` },
    { key: 'fat', label: `${Math.round(nutrients.fatG)}F` },
  ];
  if (nutrients.fiberG !== null) {
    macros.push({ key: 'fiber', label: `${Math.round(nutrients.fiberG)} fibre` });
  }

  /*
    The card is a plain View, and the two things you can do to it are two
    separate controls inside it.

    It used to be one big pressable with the stepper nested inside it, which
    is a button inside a button: invalid on web, and on a phone it left the
    minus key able to open the meal as well as take a portion off it. The
    card still reads as one object because it is one surface; it simply has
    two targets on it.
  */
  const open = (
    <>
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 15,
          overflow: 'hidden',
          backgroundColor: theme.colors.surfaceAlt,
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
            // Decorative: the meal's name is right beside it.
            accessibilityElementsHidden
          />
        ) : (
          <Icon name="leaf" size={20} color="textSubtle" strokeWidth={1.6} />
        )}
      </View>

      <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
        <Text variant="headline" numberOfLines={1} style={{ fontSize: 15 }}>
          {entry.title}
        </Text>
        <Text variant="caption" color="textSubtle">
          {subtitle}
        </Text>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: 1 }}>
          {macros.map((macro) => (
            <Text
              key={macro.key}
              variant="caption"
              color={macro.key}
              style={{ fontWeight: '700', fontSize: 11 }}
            >
              {macro.label}
            </Text>
          ))}
        </View>
      </View>

    </>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
      }}
    >
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${entry.title}, ${Math.round(nutrients.caloriesKcal)} kilocalories`}
        scaleTo={0.99}
        style={{ flex: 1, flexDirection: 'row', gap: theme.spacing.md }}
      >
        {open}
      </PressableScale>

      <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Text variant="metricM" style={{ fontSize: 18 }}>
          {Math.round(nutrients.caloriesKcal)}
        </Text>

        {single !== null && onChangeServings ? (
          <ServingStepper
            quantity={single.portion.quantity}
            busy={busy}
            label={entry.title}
            onChange={onChangeServings}
          />
        ) : (
          <Icon name="chevronRight" size={16} color="textSubtle" />
        )}
      </View>
    </View>
  );
}

/**
 * Minus, the amount, plus.
 *
 * The step is one whole unit of whatever the portion is written in - one
 * bowl, one slice, 100 g - so pressing + once changes the day by a helping
 * rather than by a rounding error. It never goes below one: zero of
 * something is a deletion, and deletions live in the record where they can
 * be explained and undone.
 */
function ServingStepper({
  quantity,
  busy,
  label,
  onChange,
}: {
  quantity: number;
  busy: boolean;
  label: string;
  onChange: (quantity: number) => void;
}) {
  const theme = useTheme();
  const step = quantity >= 20 ? 10 : 1;
  const shown = Number.isInteger(quantity) ? quantity : Math.round(quantity * 10) / 10;

  const button = (direction: -1 | 1) => {
    const next = Math.max(step, quantity + direction * step);
    const disabled = busy || (direction === -1 && quantity <= step);

    return (
      <PressableScale
        onPress={() => onChange(next)}
        disabled={disabled}
        haptic
        accessibilityRole="button"
        accessibilityLabel={`${direction === 1 ? 'More' : 'Less'} ${label}`}
        scaleTo={0.88}
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.35 : 1,
          backgroundColor:
            direction === 1 ? theme.colors.primarySoft : theme.colors.surfaceAlt,
        }}
      >
        <Icon
          name={direction === 1 ? 'plus' : 'minus'}
          size={13}
          color={direction === 1 ? 'primary' : 'textMuted'}
          strokeWidth={2.4}
        />
      </PressableScale>
    );
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      {button(-1)}
      <Text variant="metricS" style={{ minWidth: 14, textAlign: 'center' }}>
        {shown}
      </Text>
      {button(1)}
    </View>
  );
}
