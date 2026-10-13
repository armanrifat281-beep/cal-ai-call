import { View } from 'react-native';

import { Surface, Text } from '@/components/ui';
import {
  describeConfidence,
  type DayConfidence,
} from '@/features/nutrition';
import { ramps, useTheme } from '@/theme';

export interface ConfidenceBarProps {
  confidence: DayConfidence;
}

/**
 * How much of today is known, rather than guessed.
 *
 * This is the app's whole argument in one strip, and nothing else on the
 * market shows it. Every nutrition app can say you ate 1,840 calories. This
 * says which of them were measured in a laboratory, which a model guessed
 * from a photograph, and which you typed yourself - so you know which part
 * of the day is worth correcting before you trust the total.
 *
 * The bar is sized by calories, so the segment that looks big is the one
 * that actually moves the number.
 *
 * It does not grade the day. There is no "good" share: a day of home
 * cooking honestly logged by hand is not worse than a day of packets, and a
 * score would say it was.
 */
interface Segment {
  key: string;
  label: string;
  kcal: number;
  color: string;
}

export function ConfidenceBar({ confidence }: ConfidenceBarProps) {
  const theme = useTheme();

  const segments: Segment[] = [
    {
      key: 'measured',
      label: 'Measured',
      kcal: confidence.measuredKcal,
      color: theme.colors.chart,
    },
    {
      key: 'own',
      label: 'Yours',
      kcal: confidence.ownKcal,
      // Distinguished from measured by lightness as well as hue, so the two
      // are still separable in greyscale or with colour-blindness.
      color: ramps.forest[200],
    },
    {
      key: 'estimated',
      label: 'Estimated',
      kcal: confidence.estimatedKcal,
      color: theme.colors.carbs,
    },
    {
      key: 'demo',
      label: 'Sample',
      kcal: confidence.demoKcal,
      color: theme.colors.textSubtle,
    },
  ].filter((segment) => segment.kcal > 0);

  const total = segments.reduce((sum, segment) => sum + segment.kcal, 0);
  const sentence = describeConfidence(confidence);

  // Nothing quantified yet: a bar of nothing says nothing.
  if (total <= 0 || sentence === null) return null;

  return (
    <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.md }}>
      <Text variant="label" color="textMuted">
        WHERE TODAY&apos;S NUMBERS CAME FROM
      </Text>

      <View
        style={{
          flexDirection: 'row',
          height: 10,
          borderRadius: 5,
          overflow: 'hidden',
          backgroundColor: theme.colors.surfaceAlt,
        }}
        accessibilityRole="image"
        accessibilityLabel={sentence}
      >
        {segments.map((segment) => (
          <View
            key={segment.key}
            style={{ flex: segment.kcal / total, backgroundColor: segment.color }}
          />
        ))}
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.base,
        }}
      >
        {segments.map((segment) => (
          <View
            key={segment.key}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: segment.color,
              }}
            />
            {/* The legend carries the bar for anyone who cannot separate its
                colours, so it names the figure as well as the colour. */}
            <Text variant="caption" color="textMuted">
              {`${segment.label} ${Math.round(segment.kcal)}`}
            </Text>
          </View>
        ))}
      </View>

      {confidence.unquantifiedCount > 0 ? (
        <Text variant="caption" color="textSubtle">
          {`${confidence.unquantifiedCount} food${confidence.unquantifiedCount === 1 ? '' : 's'} had no calorie figure at all, so ${confidence.unquantifiedCount === 1 ? 'it is' : 'they are'} not in the bar.`}
        </Text>
      ) : null}
    </Surface>
  );
}
