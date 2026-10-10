import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, InfoNote, Text, TextField } from '@/components/ui';
import { ChipGroup } from '@/features/onboarding/ChipGroup';
import {
  COMMON_ALLERGEN_SUGGESTIONS,
  CUISINE_OPTIONS,
  DIETARY_PATTERN_OPTIONS,
} from '@/features/onboarding/options';
import { StepLayout } from '@/features/onboarding/StepLayout';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import type { DietaryPattern } from '@/types/domain';

export default function FoodPreferencesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const preferences = usePreferencesStore((state) => state.preferences);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);
  const setAllergens = usePreferencesStore((state) => state.setAllergens);

  const [patterns, setPatterns] = useState<DietaryPattern[]>(preferences.dietaryPatterns);
  const [cuisines, setCuisines] = useState<string[]>(preferences.favoriteCuisines);

  // Allergies are asked for only after the user opts in, and the opt-in says
  // why we would store it. Nothing is collected if they leave this closed.
  const [wantsAllergyFiltering, setWantsAllergyFiltering] = useState(
    preferences.allergyAwarenessEnabled,
  );
  const [allergens, setAllergensDraft] = useState<string[]>(preferences.allergens);
  const [customAllergen, setCustomAllergen] = useState('');

  const togglePattern = (value: DietaryPattern) => {
    setPatterns((current) => {
      // "No restrictions" is exclusive: it cannot combine with a restriction.
      if (value === 'no_restriction') {
        return current.includes('no_restriction') ? [] : ['no_restriction'];
      }
      const withoutNone = current.filter((p) => p !== 'no_restriction');
      return withoutNone.includes(value)
        ? withoutNone.filter((p) => p !== value)
        : [...withoutNone, value];
    });
  };

  const toggleCuisine = (value: string) => {
    setCuisines((current) =>
      current.includes(value)
        ? current.filter((c) => c !== value)
        : [...current, value],
    );
  };

  const toggleAllergen = (value: string) => {
    setAllergensDraft((current) =>
      current.includes(value)
        ? current.filter((a) => a !== value)
        : [...current, value],
    );
  };

  const addCustomAllergen = () => {
    const trimmed = customAllergen.trim();
    if (trimmed.length === 0) return;
    setAllergensDraft((current) =>
      current.some((a) => a.toLowerCase() === trimmed.toLowerCase())
        ? current
        : [...current, trimmed],
    );
    setCustomAllergen('');
  };

  const save = () => {
    setPreferences({
      dietaryPatterns: patterns,
      favoriteCuisines: cuisines,
      allergyAwarenessEnabled: wantsAllergyFiltering,
    });
    // Clear stored allergens if the user turned the feature back off.
    setAllergens(wantsAllergyFiltering ? allergens : []);
    router.push('/(onboarding)/goals');
  };

  return (
    <StepLayout
      step={2}
      totalSteps={4}
      title="How do you eat?"
      subtitle="Used to order meal suggestions. It does not change how your photos are analysed."
      primaryLabel="Continue"
      onPrimary={save}
      skipLabel="Skip for now"
      onSkip={() => router.push('/(onboarding)/goals')}
    >
      <ChipGroup
        label="EATING PATTERN"
        options={DIETARY_PATTERN_OPTIONS}
        selected={patterns}
        onToggle={togglePattern}
        help="Pick as many as apply, or none."
      />

      <ChipGroup
        label="CUISINES YOU LIKE"
        options={CUISINE_OPTIONS.map((c) => ({ value: c, label: c }))}
        selected={cuisines}
        onToggle={toggleCuisine}
      />

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="bodySmStrong" color="textMuted">
          INGREDIENTS TO AVOID
        </Text>

        {!wantsAllergyFiltering ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="bodySm" color="textMuted">
              If you tell FoodLens which ingredients to avoid, meal suggestions
              that list them will be filtered out. We store these only for that
              purpose, and you can delete them at any time.
            </Text>
            <Button
              label="Add ingredients to avoid"
              variant="secondary"
              size="sm"
              onPress={() => setWantsAllergyFiltering(true)}
            />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            <InfoNote
              title="This is not a safety check"
              body="Filtering is based on recipe text and AI output, which can be wrong or incomplete. Never rely on FoodLens to decide whether a food is safe for an allergy. Always read the actual label."
              tone="warning"
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {COMMON_ALLERGEN_SUGGESTIONS.map((suggestion) => (
                <Chip
                  key={suggestion}
                  label={suggestion}
                  selected={allergens.includes(suggestion)}
                  onPress={() => toggleAllergen(suggestion)}
                />
              ))}
            </View>

            {allergens.filter((a) => !COMMON_ALLERGEN_SUGGESTIONS.includes(a)).length >
            0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="caption" color="textMuted">
                  ALSO AVOIDING
                </Text>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
                >
                  {allergens
                    .filter((a) => !COMMON_ALLERGEN_SUGGESTIONS.includes(a))
                    .map((custom) => (
                      <Chip
                        key={custom}
                        label={`${custom}  x`}
                        selected
                        onPress={() => toggleAllergen(custom)}
                      />
                    ))}
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
              <TextField
                label="Something else"
                value={customAllergen}
                onChangeText={setCustomAllergen}
                onSubmitEditing={addCustomAllergen}
                placeholder="e.g. Mango"
                returnKeyType="done"
                autoCapitalize="sentences"
                containerStyle={{ flex: 1 }}
              />
              <Button
                label="Add"
                variant="secondary"
                onPress={addCustomAllergen}
                disabled={customAllergen.trim().length === 0}
              />
            </View>

            <Button
              label="Remove all and turn this off"
              variant="ghost"
              size="sm"
              onPress={() => {
                setWantsAllergyFiltering(false);
                setAllergensDraft([]);
              }}
            />
          </View>
        )}
      </View>
    </StepLayout>
  );
}
