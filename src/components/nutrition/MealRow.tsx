import { Image } from 'expo-image';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PressableScale, Text } from '@/components/ui';
import { computeEntryTotals } from '@/features/nutrition';
import { mealPhotoUri } from '@/features/photos';
import { formatTimeOfDay } from '@/lib/date';
import { useTheme } from '@/theme';
import type { FoodEntry } from '@/types/domain';

import { MacroBar } from './MacroBar';
import { aggregateSource } from './SourceBadge';

export interface MealRowProps {
  entry: FoodEntry;
  onPress?: () => void;
  /** Draws a hairline above. Set on every row except the first. */
  divided?: boolean;
  /** Hides the macro bar, for dense lists. */
  compact?: boolean;
}

/**
 * One logged meal in a list.
 *
 * A row, not a card. Earlier revisions gave every meal its own outlined box,
 * which turned a day's eating into a stack of identical rectangles. Here the
 * time sits in a fixed-width rail on the left so the column aligns down the
 * list, and the energy figure is right-aligned in tabular digits so the
 * numbers line up too. Those two alignments do the work an outline was doing.
 *
 * When the meal has a photo, it takes over that rail with the time beneath
 * it. The rail keeps its width either way, so a day of photographed and
 * typed meals still reads as one aligned column rather than two.
 */
/** Shared by the rail and the divider's inset, so they cannot drift apart. */
const RAIL_WIDTH = 52;

export function MealRow({ entry, onPress, divided = false, compact = false }: MealRowProps) {
  const theme = useTheme();
  const totals = computeEntryTotals(entry);
  const photoUri = mealPhotoUri(entry.id);
  const source = aggregateSource(entry.items.map((item) => item.provenance.source));
  const isEstimate = source === 'ai_estimate';

  const itemSummary = entry.items
    .slice(0, 3)
    .map((item) => item.name)
    .join(', ');
  const extra = Math.max(0, entry.items.length - 3);

  const body = (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
      }}
    >
      {/* Time rail: fixed width, so the column lines up down the list. */}
      <View style={{ width: RAIL_WIDTH, paddingTop: 2, gap: 6 }}>
        {/*
          The time comes first and the photo hangs below it. Putting the
          photo on top instead pushed the time to different heights on
          photographed and typed meals, and the time column - the thing that
          makes this list scan as a day - visibly zigzagged.
        */}
        <Text variant="metricS" color="textMuted">
          {formatTimeOfDay(entry.consumedAt)}
        </Text>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={{
              width: RAIL_WIDTH,
              height: RAIL_WIDTH,
              borderRadius: theme.radius.control,
              backgroundColor: theme.colors.surfaceAlt,
            }}
            contentFit="cover"
            transition={160}
            cachePolicy="memory-disk"
            // The row already announces the meal; the picture adds nothing
            // a screen reader can use, so it stays out of the tree.
            accessible={false}
          />
        ) : null}
      </View>

      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>
            {entry.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {/*
              An estimate is marked with a small dot rather than a pill. A row
              of coloured badges on every meal was noise; this is noticed
              once and then read as a property of the row.
            */}
            {isEstimate ? (
              <View
                accessibilityLabel="Includes an AI estimate"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.colors.warning,
                }}
              />
            ) : null}
            <Text variant="metricM">{Math.round(totals.nutrients.caloriesKcal)}</Text>
            <Text variant="caption" color="textMuted">
              kcal
            </Text>
          </View>
        </View>

        {itemSummary.length > 0 ? (
          <Text variant="footnote" color="textMuted" numberOfLines={1}>
            {itemSummary}
            {extra > 0 ? ` +${extra}` : ''}
          </Text>
        ) : null}

        {!compact ? (
          <MacroBar nutrients={totals.nutrients} showLegend={false} height={4} />
        ) : null}
      </View>

      {onPress ? (
        <View style={{ justifyContent: 'center' }}>
          <Icon name="chevronRight" size={16} color="textSubtle" />
        </View>
      ) : null}
    </View>
  );

  const divider = divided ? (
    <View
      style={{
        height: theme.hairline,
        backgroundColor: theme.colors.separator,
        marginLeft: RAIL_WIDTH + theme.spacing.md,
      }}
    />
  ) : null;

  if (!onPress) {
    return (
      <View>
        {divider}
        {body}
      </View>
    );
  }

  return (
    <View>
      {divider}
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${entry.title}, ${Math.round(totals.nutrients.caloriesKcal)} kcal`}
        accessibilityHint="Opens this meal to view or edit it"
        scaleTo={0.99}
      >
        {body}
      </PressableScale>
    </View>
  );
}
