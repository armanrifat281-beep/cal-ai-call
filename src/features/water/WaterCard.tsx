import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Metric, PressableScale, Surface, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { useDayWater } from './hooks';

/** One tap. The size of an ordinary glass. */
export const GLASS_ML = 250;

/** How many glasses the row draws. Eight is the usual rule of thumb. */
const GLASSES = 8;

/**
 * Water for the day.
 *
 * Eight tappable glasses rather than a number and a plus button: the row
 * answers "how am I doing" at a glance, which a figure alone does not, and
 * tapping the next empty glass is a single gesture with an obvious target.
 *
 * The count is summed from individual drinks, so tapping the last filled
 * glass takes one back. A running total would have no way to undo a mis-tap,
 * and on a button people hit repeatedly that matters more than it sounds.
 *
 * Deliberately no daily target and no praise. The app does not tell anyone
 * how much they should drink - the same position it takes on calories - so
 * eight glasses is a scale to read against, not a goal it set for you.
 */
export function WaterCard() {
  const theme = useTheme();
  const water = useDayWater();

  const filled = Math.min(Math.round(water.totalMl / GLASS_ML), GLASSES);
  const litres = (water.totalMl / 1000).toFixed(water.totalMl >= 1000 ? 1 : 2);

  return (
    <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.base }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="label" color="textMuted">
          WATER
        </Text>
        <Metric value={litres} unit="L" size="s" />
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        {Array.from({ length: GLASSES }, (_, index) => {
          const isFilled = index < filled;
          // Tapping a filled glass undoes only when it is the last one:
          // removing from the middle of a row nobody ordered would be a
          // surprise.
          const isLastFilled = isFilled && index === filled - 1;

          return (
            <PressableScale
              key={index}
              onPress={() =>
                void (isLastFilled ? water.undoLast() : water.add(GLASS_ML))
              }
              haptic
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityLabel={
                isLastFilled
                  ? 'Take back the last glass'
                  : `Add a glass, ${index + 1} of ${GLASSES}`
              }
              style={{
                flex: 1,
                height: 44,
                borderRadius: theme.radius.xs,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isFilled
                  ? theme.colors.chart
                  : theme.colors.surfaceAlt,
              }}
            >
              <Icon
                name="droplet"
                size={15}
                color={isFilled ? theme.colors.background : 'textSubtle'}
                strokeWidth={1.6}
              />
            </PressableScale>
          );
        })}
      </View>

      <Text variant="caption" color="textSubtle">
        {filled === 0
          ? 'Tap a glass as you drink it.'
          : `${filled} glass${filled === 1 ? '' : 'es'} · tap the last one to take it back.`}
      </Text>
    </Surface>
  );
}
