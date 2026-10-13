import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Button,
  ErrorState,
  Metric,
  Surface,
  Text,
  TextField,
} from '@/components/ui';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

import { useWeightHistory } from './hooks';

const KG_PER_LB = 0.45359237;

/** Bounds matching the database constraint, so a typo is caught here first. */
const MIN_KG = 20;
const MAX_KG = 400;

/**
 * Body weight, and which way it is going.
 *
 * The one number people actually judge a nutrition app by, and the only
 * card on Home that is worth looking at from the first day: it needs no
 * logged meals, no backend and no API key.
 *
 * It leads with the change rather than the number. A weight today says
 * nothing on its own - "74.2 kg" is just a fact - where "down 1.4 kg over
 * 28 days" is the thing being tracked. Below two readings there is no
 * direction, so none is shown rather than one being implied.
 *
 * Deliberately no target weight and no judgement about the direction. The
 * app does not tell anyone what they should weigh, the same position it
 * takes on calories.
 */
export function WeightCard() {
  const theme = useTheme();
  const weight = useWeightHistory();
  const system = usePreferencesStore((state) => state.preferences.measurementSystem);
  const imperial = system === 'imperial';

  const [entering, setEntering] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const unit = imperial ? 'lb' : 'kg';
  const toDisplay = (kg: number) => (imperial ? kg / KG_PER_LB : kg);

  const parsed = Number(draft.trim());
  const draftKg = imperial ? parsed * KG_PER_LB : parsed;
  const valid =
    draft.trim().length > 0 &&
    Number.isFinite(parsed) &&
    draftKg >= MIN_KG &&
    draftKg <= MAX_KG;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    await weight.add(Number(draftKg.toFixed(2)));
    setSaving(false);
    setDraft('');
    setEntering(false);
  };

  return (
    <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.base }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="label" color="textMuted">
          WEIGHT
        </Text>
        {weight.latest !== null && !entering ? (
          <Text
            variant="footnote"
            color="textMuted"
            style={{ fontWeight: '600' }}
            onPress={() => setEntering(true)}
            accessibilityRole="button"
            accessibilityLabel="Add a new weight reading"
          >
            Add
          </Text>
        ) : null}
      </View>

      {weight.error ? (
        <ErrorState message={weight.error.message} detail={weight.error.detail} />
      ) : null}

      {entering || weight.latest === null ? (
        <View style={{ gap: theme.spacing.md }}>
          <TextField
            label={`Weight in ${unit}`}
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            placeholder={imperial ? 'e.g. 165' : 'e.g. 75'}
            error={
              draft.trim().length > 0 && !valid
                ? `Enter a weight between ${Math.round(toDisplay(MIN_KG))} and ${Math.round(toDisplay(MAX_KG))} ${unit}.`
                : null
            }
            onSubmitEditing={() => void save()}
            returnKeyType="done"
          />
          <Button
            label="Save"
            onPress={() => void save()}
            loading={saving}
            disabled={!valid}
            fullWidth
            haptic
          />
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <Metric
            value={toDisplay(weight.latest.weightKg).toFixed(1)}
            unit={unit}
            size="l"
          />

          {weight.changeKg !== null && weight.changeOverDays !== null ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.xs,
              }}
            >
              <Icon
                name={weight.changeKg < 0 ? 'chevronDown' : 'chevronUp'}
                size={15}
                color="textMuted"
                strokeWidth={2.4}
              />
              {/*
                No colour on the direction. Down is not "good" and up is not
                "bad" - that depends on what the person is doing and why,
                and this app does not presume to know.
              */}
              <Text variant="footnote" color="textMuted">
                {`${Math.abs(toDisplay(weight.changeKg)).toFixed(1)} ${unit} in ${weight.changeOverDays} days`}
              </Text>
            </View>
          ) : (
            <Text variant="footnote" color="textSubtle">
              Weigh in again to see a trend
            </Text>
          )}
        </View>
      )}
    </Surface>
  );
}
