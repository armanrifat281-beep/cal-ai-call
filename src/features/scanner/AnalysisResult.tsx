import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { SourceBadge } from '@/components/nutrition';
import { Appear, Button, Metric, Row, Surface, Text } from '@/components/ui';
import { sumNutrients } from '@/features/nutrition';
import { useTheme } from '@/theme';
import type { FoodEntryItem } from '@/types/domain';

import type { MealAnalysis } from './types';

export interface AnalysisResultProps {
  analysis: MealAnalysis;
  /** Already converted by `analysisToEntryItems`. */
  items: readonly FoodEntryItem[];
  /** Open the editor with these items, to correct them before saving. */
  onEdit: () => void;
  /** Save as it stands. */
  onSave: () => void;
  /** Throw this analysis away and go back to the camera. */
  onDiscard: () => void;
  saving?: boolean;
}

/**
 * What the analyser found, before anything is saved.
 *
 * This screen is the app's whole argument. Any nutrition app can show a
 * number; the claim here is that you can see where each number came from and
 * change the ones that are wrong. So every row carries its source badge, the
 * caveats the analyser raised are printed rather than buried, and nothing is
 * written to the journal until the user says so.
 *
 * The totals are deliberately computed from the items rather than taken from
 * the analysis, so the figure shown is the figure that will be saved - if a
 * portion is corrected in the editor, there is no second number left over
 * from the original guess.
 */
export function AnalysisResult({
  analysis,
  items,
  onEdit,
  onSave,
  onDiscard,
  saving = false,
}: AnalysisResultProps) {
  const theme = useTheme();
  const totals = sumNutrients(items.map((item) => item.nutrients));

  return (
    <View style={{ gap: theme.blockGap }}>
      <Appear index={0}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title1">{analysis.suggestedTitle}</Text>
          <Text variant="footnote" color="textMuted">
            {items.length === 1
              ? 'One item found · tap it to correct it'
              : `${items.length} items found · tap any to correct it`}
          </Text>
        </View>
      </Appear>

      <Appear index={1}>
        <Surface variant="raised" padding="lg" style={{ gap: theme.spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: theme.spacing.lg,
            }}
          >
            <Metric
              value={String(Math.round(totals.nutrients.caloriesKcal))}
              label="KCAL"
              size="xl"
            />
            <View style={{ flexGrow: 1, flexDirection: 'row', gap: theme.spacing.base }}>
              <Metric value={`${Math.round(totals.nutrients.proteinG)} g`} label="Protein" />
              <Metric value={`${Math.round(totals.nutrients.carbsG)} g`} label="Carbs" />
              <Metric value={`${Math.round(totals.nutrients.fatG)} g`} label="Fat" />
            </View>
          </View>
        </Surface>
      </Appear>

      {/* What the analyser itself said it could not be sure about. Printed,
          not folded away: these are the numbers most likely to be wrong. */}
      {analysis.caveats.length > 0 ? (
        <Appear index={2}>
          <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <Icon name="info" size={16} color="textMuted" />
              <Text variant="label" color="textMuted">
                WORTH CHECKING
              </Text>
            </View>
            {analysis.caveats.map((caveat) => (
              <Text key={caveat} variant="footnote" color="textMuted">
                {caveat}
              </Text>
            ))}
          </Surface>
        </Appear>
      ) : null}

      <Appear index={3}>
        <Surface variant="grouped">
          {items.map((item, index) => (
            <Row
              key={item.id}
              title={item.name}
              subtitle={describePortion(item)}
              divided={index > 0}
              trailing={
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                  }}
                >
                  <Text variant="metricS">
                    {Math.round(item.nutrients.caloriesKcal)}
                  </Text>
                  <Icon name="chevronRight" size={15} color="textSubtle" />
                </View>
              }
              below={
                <SourceBadge
                  source={item.provenance.source}
                  confidence={item.provenance.confidence}
                />
              }
              onPress={onEdit}
            />
          ))}
        </Surface>
      </Appear>

      <Appear index={4}>
        <View style={{ gap: theme.spacing.md }}>
          <Button
            label="Save to today"
            onPress={onSave}
            loading={saving}
            size="lg"
            fullWidth
            haptic
          />
          <Button label="Correct the items first" variant="secondary" onPress={onEdit} fullWidth />
          <Button label="Discard this scan" variant="ghost" size="sm" onPress={onDiscard} />
        </View>
      </Appear>
    </View>
  );
}

/** "150 g" or "1 cup · 90 g", without repeating a weight it already shows. */
function describePortion(item: FoodEntryItem): string {
  const { quantity, unit } = item.portion;
  const portion = `${quantity} ${unit}`;
  if (item.gramsResolved === null) return portion;
  if (unit === 'g') return portion;
  return `${portion} · ${Math.round(item.gramsResolved)} g`;
}
