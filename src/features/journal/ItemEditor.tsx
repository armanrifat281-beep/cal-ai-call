import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { SourceBadge } from '@/components/nutrition';
import {
  Button,
  Card,
  Divider,
  IconButton,
  InfoNote,
  NumberField,
  SegmentedControl,
  Text,
  TextField,
} from '@/components/ui';
import { checkMacroConsistency, formatCalories } from '@/features/nutrition';
import { useTheme } from '@/theme';
import type { FoodEntryItem, PortionUnit } from '@/types/domain';

/**
 * Editor for one food item inside a meal.
 *
 * Every field is editable, including values that came from a database or a
 * model: a correction the user makes is recorded as `user_entered` so the
 * provenance stays truthful.
 */

const UNIT_OPTIONS: { value: PortionUnit; label: string }[] = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'piece', label: 'piece' },
  { value: 'serving', label: 'serving' },
];

export interface ItemEditorProps {
  item: FoodEntryItem;
  onChange: (next: FoodEntryItem) => void;
  onRemove: () => void;
  /** Open on mount, used for a freshly added item. */
  initiallyExpanded?: boolean;
}

export function ItemEditor({
  item,
  onChange,
  onRemove,
  initiallyExpanded = false,
}: ItemEditorProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(initiallyExpanded);

  /**
   * Apply an edit and record that the user is now the source of these numbers.
   * Changing only the name leaves nutrient provenance alone.
   */
  const applyNutrientEdit = (patch: Partial<FoodEntryItem['nutrients']>) => {
    onChange({
      ...item,
      nutrients: { ...item.nutrients, ...patch },
      provenance: {
        ...item.provenance,
        source: 'user_entered',
        confidence: 'high',
      },
    });
  };

  const consistency = checkMacroConsistency(item.nutrients);
  const nameError = item.name.trim().length === 0 ? 'Give this food a name.' : null;

  return (
    <Card padding="none" style={{ overflow: 'hidden' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          padding: theme.spacing.base,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {item.name.trim().length > 0 ? item.name : 'Untitled food'}
          </Text>
          <Text variant="caption" color="textMuted">
            {item.portion.quantity} {item.portion.unit} -{' '}
            {formatCalories(item.nutrients.caloriesKcal)}
          </Text>
        </View>

        <IconButton
          accessibilityLabel={expanded ? 'Collapse this food' : 'Edit this food'}
          onPress={() => setExpanded((open) => !open)}
          variant="soft"
        >
          <Icon name={expanded ? 'close' : 'pencil'} size={18} color="textMuted" />
        </IconButton>

        <IconButton
          accessibilityLabel={`Remove ${item.name || 'this food'}`}
          onPress={onRemove}
          variant="soft"
        >
          <Icon name="trash" size={18} color="danger" />
        </IconButton>
      </View>

      {expanded ? (
        <>
          <Divider />
          <View style={{ padding: theme.spacing.base, gap: theme.spacing.base }}>
            <TextField
              label="Food"
              value={item.name}
              onChangeText={(name) => onChange({ ...item, name })}
              placeholder="e.g. Grilled chicken thigh"
              error={nameError}
              autoCapitalize="sentences"
            />

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <NumberField
                label="Amount"
                value={item.portion.quantity}
                onChangeValue={(quantity) =>
                  onChange({
                    ...item,
                    portion: { ...item.portion, quantity: quantity ?? 0 },
                  })
                }
                min={0}
                requireValue
                containerStyle={{ flex: 1 }}
              />
              <View style={{ flex: 1.6, gap: theme.spacing.xs }}>
                <Text variant="bodySmStrong" color="textMuted">
                  Unit
                </Text>
                <SegmentedControl
                  options={UNIT_OPTIONS}
                  value={item.portion.unit}
                  onChange={(unit) =>
                    onChange({
                      ...item,
                      portion: { ...item.portion, unit },
                      // The stored weight no longer matches the new unit.
                      gramsResolved: unit === 'g' ? item.portion.quantity : null,
                    })
                  }
                  accessibilityLabel="Portion unit"
                />
              </View>
            </View>

            <Divider />

            <Text variant="bodySmStrong" color="textMuted">
              NUTRITION FOR THIS PORTION
            </Text>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <NumberField
                label="Calories"
                value={item.nutrients.caloriesKcal}
                onChangeValue={(caloriesKcal) =>
                  applyNutrientEdit({ caloriesKcal: caloriesKcal ?? 0 })
                }
                allowDecimal={false}
                min={0}
                max={10000}
                requireValue
                containerStyle={{ flex: 1 }}
              />
              <NumberField
                label="Protein (g)"
                value={item.nutrients.proteinG}
                onChangeValue={(proteinG) => applyNutrientEdit({ proteinG: proteinG ?? 0 })}
                min={0}
                max={500}
                containerStyle={{ flex: 1 }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <NumberField
                label="Carbs (g)"
                value={item.nutrients.carbsG}
                onChangeValue={(carbsG) => applyNutrientEdit({ carbsG: carbsG ?? 0 })}
                min={0}
                max={1000}
                containerStyle={{ flex: 1 }}
              />
              <NumberField
                label="Fat (g)"
                value={item.nutrients.fatG}
                onChangeValue={(fatG) => applyNutrientEdit({ fatG: fatG ?? 0 })}
                min={0}
                max={500}
                containerStyle={{ flex: 1 }}
              />
            </View>

            {consistency.isInconsistent ? (
              <InfoNote
                title="These numbers do not add up"
                body={`Protein, carbs and fat come to about ${Math.round(
                  consistency.impliedKcal,
                )} kcal, but calories say ${Math.round(
                  consistency.statedKcal,
                )}. One of them is probably wrong.`}
                tone="warning"
              />
            ) : null}

            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="caption" color="textMuted">
                WHERE THESE NUMBERS CAME FROM
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <SourceBadge
                  source={item.provenance.source}
                  confidence={item.provenance.confidence}
                />
              </View>
              {item.provenance.providerLabel ? (
                <Text variant="caption" color="textMuted">
                  {item.provenance.providerLabel}
                  {item.provenance.providerRef ? ` - ref ${item.provenance.providerRef}` : ''}
                </Text>
              ) : null}
            </View>

            <Button
              label="Done editing"
              variant="secondary"
              size="sm"
              onPress={() => setExpanded(false)}
            />
          </View>
        </>
      ) : null}
    </Card>
  );
}
