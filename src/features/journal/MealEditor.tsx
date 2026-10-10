import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { MacroBar } from '@/components/nutrition';
import {
  Button,
  Card,
  ErrorState,
  InfoNote,
  Screen,
  SegmentedControl,
  Text,
  TextField,
} from '@/components/ui';
import { computeEntryTotals, formatCalories } from '@/features/nutrition';
import { formatDayLabel, formatTimeOfDay, toDateKey } from '@/lib/date';
import { newId } from '@/lib/id';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';
import {
  EMPTY_NUTRIENTS,
  MEAL_TYPES,
  type FoodEntry,
  type FoodEntryItem,
  type MealType,
} from '@/types/domain';

import { ItemEditor } from './ItemEditor';

/**
 * Create or edit one meal.
 *
 * This is a complete, working path that needs no backend and no AI: a user can
 * log everything by hand. The scanner feeds this same editor, so corrections
 * work identically whether the numbers came from a photo or a keyboard.
 */

const MEAL_TYPE_OPTIONS = MEAL_TYPES.map((type) => ({
  value: type,
  label: type.charAt(0).toUpperCase() + type.slice(1),
}));

export interface MealEditorProps {
  mode: 'create' | 'edit';
  /** Existing entry when editing, or a prefilled draft from the scanner. */
  initial?: Partial<Pick<FoodEntry, 'title' | 'mealType' | 'consumedAt' | 'items' | 'notes'>>;
  /** Shown above the form, e.g. the scanner's uncertainty warnings. */
  banner?: React.ReactNode;
  saving: boolean;
  saveError: AppError | null;
  onSave: (draft: MealDraft) => void;
  onDelete?: () => void;
  /** Label for the primary button, e.g. "Save meal" or "Log to today". */
  saveLabel?: string;
}

export interface MealDraft {
  title: string;
  mealType: MealType;
  consumedAt: string;
  items: FoodEntryItem[];
  notes: string | null;
}

/** A blank item, used by "Add food". */
function blankItem(): FoodEntryItem {
  return {
    id: newId(),
    name: '',
    brand: null,
    portion: { quantity: 100, unit: 'g' },
    gramsResolved: 100,
    nutrients: { ...EMPTY_NUTRIENTS },
    provenance: {
      source: 'user_entered',
      confidence: 'high',
      providerLabel: null,
      providerRef: null,
    },
    foodRecordId: null,
    notes: null,
  };
}

/** Meal type guessed from the clock, so the common case needs no tap. */
export function mealTypeForHour(hour: number): MealType {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export function MealEditor({
  mode,
  initial,
  banner,
  saving,
  saveError,
  onSave,
  onDelete,
  saveLabel,
}: MealEditorProps) {
  const theme = useTheme();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [mealType, setMealType] = useState<MealType>(
    initial?.mealType ?? mealTypeForHour(new Date().getHours()),
  );
  const [consumedAt, setConsumedAt] = useState<Date>(() =>
    initial?.consumedAt ? new Date(initial.consumedAt) : new Date(),
  );
  const [items, setItems] = useState<FoodEntryItem[]>(initial?.items ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [newestItemId, setNewestItemId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'none' | 'date' | 'time'>('none');
  const [submitted, setSubmitted] = useState(false);

  const totals = useMemo(() => computeEntryTotals({ items }), [items]);

  const itemErrors = items.filter((item) => item.name.trim().length === 0).length;
  const validationError =
    items.length === 0
      ? 'Add at least one food to save this meal.'
      : itemErrors > 0
        ? `${itemErrors} food${itemErrors > 1 ? 's' : ''} still need a name.`
        : null;

  const addItem = useCallback(() => {
    const item = blankItem();
    setItems((current) => [...current, item]);
    setNewestItemId(item.id);
  }, []);

  const updateItem = useCallback((next: FoodEntryItem) => {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const handleSave = () => {
    setSubmitted(true);
    if (validationError) return;

    onSave({
      // An untitled meal gets a name from its contents rather than being blank.
      title: title.trim().length > 0 ? title.trim() : derivedTitle(items),
      mealType,
      consumedAt: consumedAt.toISOString(),
      items,
      notes: notes.trim().length > 0 ? notes.trim() : null,
    });
  };

  const confirmDelete = () => {
    if (!onDelete) return;
    Alert.alert(
      'Delete this meal?',
      'It will be removed from your journal. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ],
    );
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Android fires a dismiss event; iOS keeps the inline picker mounted.
    if (Platform.OS === 'android') setPicker('none');
    if (event.type === 'dismissed' || !selected) return;
    setConsumedAt(selected);
  };

  return (
    <Screen
      edges={{ bottom: true }}
      contentStyle={{ gap: theme.spacing.lg }}
      footer={
        <>
          {submitted && validationError ? (
            <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
              {validationError}
            </Text>
          ) : null}
          <Button
            label={saveLabel ?? (mode === 'create' ? 'Save meal' : 'Save changes')}
            onPress={handleSave}
            loading={saving}
            size="lg"
            fullWidth
            haptic
          />
          {onDelete ? (
            <Button
              label="Delete meal"
              variant="ghost"
              onPress={confirmDelete}
              fullWidth
            />
          ) : null}
        </>
      }
    >
      {banner}

      {saveError ? (
        <ErrorState
          message={saveError.message}
          detail={saveError.detail}
          onRetry={saveError.retryable ? handleSave : undefined}
          retryLabel="Try saving again"
        />
      ) : null}

      <Card padding="lg" style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color="textMuted">
            MEAL TOTAL
          </Text>
          <Text variant="caption" color="textMuted">
            {items.length} item{items.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Text variant="display">{formatCalories(totals.nutrients.caloriesKcal)}</Text>
        <MacroBar nutrients={totals.nutrients} />
      </Card>

      <View style={{ gap: theme.spacing.base }}>
        <TextField
          label="Meal name"
          value={title}
          onChangeText={setTitle}
          placeholder={items.length > 0 ? derivedTitle(items) : 'e.g. Chicken rice bowl'}
          help="Leave empty and we will name it after the foods you added."
          autoCapitalize="sentences"
        />

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="bodySmStrong" color="textMuted">
            Meal
          </Text>
          <SegmentedControl
            options={MEAL_TYPE_OPTIONS}
            value={mealType}
            onChange={setMealType}
            accessibilityLabel="Meal type"
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="bodySmStrong" color="textMuted">
            When
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              label={formatDayLabel(toDateKey(consumedAt))}
              variant="secondary"
              onPress={() => setPicker('date')}
              leading={<Icon name="clock" size={16} color="textMuted" />}
              style={{ flex: 1 }}
            />
            <Button
              label={formatTimeOfDay(consumedAt.toISOString())}
              variant="secondary"
              onPress={() => setPicker('time')}
              style={{ flex: 1 }}
            />
          </View>

          {picker !== 'none' ? (
            <DateTimePicker
              value={consumedAt}
              mode={picker}
              onChange={onPickerChange}
              // A meal cannot have been eaten in the future.
              maximumDate={picker === 'date' ? new Date() : undefined}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            />
          ) : null}

          {Platform.OS === 'ios' && picker !== 'none' ? (
            <Button
              label="Done"
              variant="ghost"
              size="sm"
              onPress={() => setPicker('none')}
            />
          ) : null}
        </View>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="heading">Foods in this meal</Text>

        {items.length === 0 ? (
          <InfoNote
            body="Add each food separately so portions and nutrients stay accurate. You can edit every number."
            tone="neutral"
          />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {items.map((item) => (
              <ItemEditor
                key={item.id}
                item={item}
                onChange={updateItem}
                onRemove={() => removeItem(item.id)}
                initiallyExpanded={item.id === newestItemId}
              />
            ))}
          </View>
        )}

        <Button
          label="Add food"
          variant="secondary"
          onPress={addItem}
          leading={<Icon name="plus" size={18} color="text" />}
          fullWidth
        />
      </View>

      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything worth remembering about this meal"
        multiline
        numberOfLines={3}
        autoCapitalize="sentences"
      />
    </Screen>
  );
}

/** Names a meal after its contents, e.g. "Rice, chicken +2 more". */
function derivedTitle(items: readonly FoodEntryItem[]): string {
  const named = items.map((item) => item.name.trim()).filter((name) => name.length > 0);
  if (named.length === 0) return 'Untitled meal';
  const head = named.slice(0, 2).join(', ');
  const extra = named.length - 2;
  return extra > 0 ? `${head} +${extra} more` : head;
}
