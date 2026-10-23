import { View } from 'react-native';

import { Text } from '@/components/ui';
import {
  SCORE_BAND_LABELS,
  type Characteristic,
  type FoodScore,
} from '@/features/nutrition';
import { useTheme } from '@/theme';

export interface ScoreCardProps {
  score: FoodScore;
  /** The reasons behind the number, from `describeNutrients`. */
  characteristics?: readonly Characteristic[];
  /** Headline wording. Defaults to "Food score". */
  label?: string;
}

/**
 * A food's score, with the sentence that explains it.
 *
 * Never the number on its own. A score of 3.2 printed beside someone's lunch
 * with no reason attached is a verdict; the same number with "high in sugar,
 * low in fibre" under it is information they can act on or disagree with.
 * That is the whole reason the scoring module returns its thresholds as
 * words as well as as a figure.
 *
 * When too little is known to score the food at all, the card says so rather
 * than printing a middling number. A hedge is honest; a 5.0 that means "no
 * idea" is not.
 */
export function ScoreCard({ score, characteristics = [], label = 'Food score' }: ScoreCardProps) {
  const theme = useTheme();

  const tone =
    score.band === 'excellent' || score.band === 'good'
      ? theme.colors.primary
      : score.band === 'fair'
        ? theme.colors.warning
        : score.band === 'poor'
          ? theme.colors.danger
          : theme.colors.textSubtle;

  const headline =
    score.value === null
      ? 'Not enough detail to score this yet'
      : characteristics.length > 0
        ? `${SCORE_BAND_LABELS[score.band]} — ${characteristics[0]!.text.toLowerCase()}`
        : SCORE_BAND_LABELS[score.band];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.base,
        padding: theme.spacing.base,
        borderRadius: 20,
        backgroundColor: theme.colors.primarySoft,
      }}
    >
      <View style={{ alignItems: 'center', minWidth: 58 }}>
        <Text variant="metricXL" color={tone} style={{ fontSize: 34, lineHeight: 38 }}>
          {score.value === null ? '—' : score.value.toFixed(1)}
        </Text>
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="headline" style={{ fontSize: 15 }}>
          {headline}
        </Text>

        {/*
          Said only when it is true and it matters. A food whose fibre,
          sugar, saturated fat and sodium are all recorded needs no hedge,
          and printing one on every card would train people to skip it.
        */}
        {score.value !== null && score.known < 0.6 ? (
          <Text variant="caption" color="textSubtle">
            Scored on {Math.round(score.known * 5)} of 5 nutrients — the rest
            were not recorded for this food.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The reasons, as a list.
 *
 * Dots rather than ticks and crosses: a tick on "low in sugar" and a cross
 * on "high in saturated fat" turns a description of a meal into a mark out
 * of ten for the person who ate it.
 */
export function CharacteristicList({
  characteristics,
}: {
  characteristics: readonly Characteristic[];
}) {
  const theme = useTheme();
  if (characteristics.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.md }}>
      {characteristics.map((characteristic) => (
        <View
          key={characteristic.text}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: characteristic.good
                ? theme.colors.primary
                : theme.colors.warning,
            }}
          />
          <Text variant="callout" style={{ flex: 1 }}>
            {characteristic.text}
          </Text>
        </View>
      ))}
    </View>
  );
}
