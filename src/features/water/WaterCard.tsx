import { View } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

import { useDayWater } from './hooks';

/** One tap. The size of an ordinary glass. */
export const GLASS_ML = 250;

/** How many marks the gauge draws when no target is set. */
const DEFAULT_GLASSES = 8;
/** Beyond this the marks are too thin to tell apart on a phone. */
const MAX_GLASSES = 12;

/**
 * Water for the day.
 *
 * A gauge rather than a row of buttons. It used to be eight tappable
 * glasses, which answered "how am I doing" well but needed the full width
 * of the screen to stay tappable; beside the macro split it now has half of
 * that, and twelve 44pt targets do not fit in half a phone. So the marks
 * became a reading and the adding became one button, which is also the
 * gesture people actually repeat.
 *
 * The count is summed from individual drinks, so the button can be undone by
 * a long press. A running total would have no way back from a mis-tap, and
 * on a control people hit several times a day that matters.
 *
 * The target is the user's own, set in Profile, and null by default: the app
 * does not tell anyone how much to drink any more than it tells them what to
 * weigh. Without one the marks are a scale to read against rather than a
 * goal it set for you.
 */
export function WaterCard() {
  const theme = useTheme();
  const water = useDayWater();
  const targetMl = usePreferencesStore((state) => state.preferences.waterTargetMl);

  const marks =
    targetMl === null
      ? DEFAULT_GLASSES
      : Math.min(MAX_GLASSES, Math.max(1, Math.round(targetMl / GLASS_ML)));
  const filled = Math.min(Math.round(water.totalMl / GLASS_ML), marks);
  const litres = (water.totalMl / 1000).toFixed(water.totalMl >= 1000 ? 1 : 2);

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.base,
        gap: theme.spacing.md,
      }}
    >
      <Text variant="callout" color="textMuted">
        Water
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text variant="metricL" style={{ fontSize: 24 }}>
          {litres}
        </Text>
        <Text variant="caption" color="textSubtle">
          {targetMl === null ? 'L' : `/ ${(targetMl / 1000).toFixed(1)} L`}
        </Text>
      </View>

      <View
        style={{ flexDirection: 'row', gap: 3, height: 26 }}
        accessibilityRole="progressbar"
        accessibilityLabel={`${filled} of ${marks} glasses`}
      >
        {Array.from({ length: marks }, (_, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              borderRadius: 3,
              backgroundColor:
                index < filled ? theme.colors.info : theme.colors.surfaceAlt,
            }}
          />
        ))}
      </View>

      <PressableScale
        onPress={() => void water.add(GLASS_ML)}
        onLongPress={() => void water.undoLast()}
        haptic
        accessibilityRole="button"
        accessibilityLabel={`Add ${GLASS_ML} millilitres of water`}
        accessibilityHint="Press and hold to take back the last glass"
        style={{
          alignItems: 'center',
          paddingVertical: 10,
          borderRadius: theme.radius.control,
          backgroundColor: theme.colors.primarySoft,
        }}
      >
        <Text variant="caption" color="primary" style={{ fontWeight: '700' }}>
          + {GLASS_ML} ml
        </Text>
      </PressableScale>
    </View>
  );
}
