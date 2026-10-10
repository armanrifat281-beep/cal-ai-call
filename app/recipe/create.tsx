import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import {
  Badge,
  Button,
  Chip,
  Disclosure,
  ErrorState,
  Screen,
  Section,
  SegmentedControl,
  Stepper,
  Text,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/features/auth';
import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  generateDemoRecipe,
  generateRecipe,
  getGenerationAvailability,
  getRecipeRepository,
  toCuisineId,
  type GeneratedRecipe,
} from '@/features/recipes';
import {
  CUISINE_OPTIONS,
  EQUIPMENT_OPTIONS,
  SERVING_PRESETS,
  TIME_OPTIONS,
} from '@/features/recipes/options';
import type { AppError } from '@/lib/result';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import type { CuisineId, RecipeRequest, RecipeRequestMode } from '@/types/recipe';

/**
 * The "what do you want to cook?" form.
 *
 * Four ways to ask, a handful of constraints, and two ways to get a recipe:
 * generate one, or - when no provider is configured - open a clearly labelled
 * bundled demo. The demo is never substituted silently.
 *
 * Food Memory fills the defaults: the dietary patterns, ingredients to avoid
 * and favourite cuisine the user already told us, plus the serving count they
 * last used. All of it is visible and editable here.
 */

const MODE_OPTIONS = [
  { value: 'dish_name' as const, label: 'A dish' },
  { value: 'description' as const, label: 'Describe it' },
  { value: 'from_pantry' as const, label: 'What I have' },
];

const PROMPT_HINTS: Record<RecipeRequestMode, { label: string; placeholder: string; help: string }> = {
  dish_name: {
    label: 'What do you want to cook?',
    placeholder: 'Chicken biryani',
    help: 'Name the dish. "Chicken biryani", "shakshuka", "dal".',
  },
  description: {
    label: 'Describe the dish',
    placeholder: 'Something warm with lentils, not too spicy',
    help: 'In your own words. Flavours, texture, how you want to feel after it.',
  },
  from_pantry: {
    label: 'Anything else to say?',
    placeholder: 'Nothing fancy, I am tired',
    help: 'Optional. List what you have below.',
  },
  from_photo: {
    label: 'Anything to add about the photo?',
    placeholder: 'I think it had coconut in it',
    help: 'Optional. A photo cannot show every ingredient, so hints help.',
  },
};

export default function CreateRecipeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ mode?: string; photoUri?: string }>();

  const preferences = usePreferencesStore((state) => state.preferences);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);

  const availability = getGenerationAvailability();

  // Arriving from the scanner means there is a photo and the mode is fixed.
  const photoUri = typeof params.photoUri === 'string' ? params.photoUri : null;
  const initialMode: RecipeRequestMode = photoUri
    ? 'from_photo'
    : params.mode === 'from_pantry'
      ? 'from_pantry'
      : 'dish_name';

  const [mode, setMode] = useState<RecipeRequestMode>(initialMode);
  const [prompt, setPrompt] = useState('');
  const [servings, setServings] = useState(preferences.preferredServings);
  // The stored value is an opaque string, so it is validated rather than
  // trusted: a cuisine removed from the list later must not break this form.
  const [cuisine, setCuisine] = useState<CuisineId | null>(
    toCuisineId(preferences.favoriteCuisineId),
  );
  const [cuisineNote, setCuisineNote] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [pantryText, setPantryText] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const pantryIngredients = useMemo(
    () =>
      pantryText
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 40),
    [pantryText],
  );

  const hints = PROMPT_HINTS[mode];

  // A pantry request needs ingredients; a photo request needs the photo; the
  // others need words.
  const promptError =
    mode === 'from_pantry'
      ? pantryIngredients.length === 0
        ? 'List at least one ingredient you have.'
        : null
      : mode === 'from_photo'
        ? photoUri
          ? null
          : 'The photo is missing. Go back and take it again.'
        : prompt.trim().length < 3
          ? 'Tell us what you would like to cook.'
          : null;

  const cuisineNoteError =
    cuisine === 'other' && cuisineNote.trim().length === 0
      ? 'Say which style you mean.'
      : null;

  const hasErrors = Boolean(promptError) || Boolean(cuisineNoteError);

  const buildRequest = (): RecipeRequest => ({
    prompt: prompt.trim(),
    mode,
    cuisine,
    cuisineNote: cuisine === 'other' ? cuisineNote.trim() : null,
    servings,
    dietaryPatterns: preferences.dietaryPatterns,
    // Only what the user asked to have respected. Nothing else about them.
    avoidIngredients: preferences.allergyAwarenessEnabled ? preferences.allergens : [],
    equipment,
    maxTotalMinutes: maxMinutes,
    pantryIngredients,
    referenceImageUri: mode === 'from_photo' ? photoUri : null,
  });

  /** Remembers the choices worth reusing next time. */
  const rememberChoices = () => {
    setPreferences({
      preferredServings: servings,
      favoriteCuisineId: cuisine,
    });
  };

  const saveAndOpen = async (generated: GeneratedRecipe, request: RecipeRequest) => {
    const repository = getRecipeRepository();
    const created = await repository.createRecipe({
      title: generated.title,
      description: generated.description,
      cuisine: generated.cuisine ?? request.cuisine,
      cuisineNote: generated.cuisineNote ?? request.cuisineNote,
      // The origin is what the UI labels the recipe with for the rest of its
      // life, so a demo stays a demo in storage, not just on screen.
      origin: generated.isDemo ? 'demo_sample' : 'ai_generated',
      servings: generated.servings,
      prepMinutes: generated.prepMinutes,
      cookMinutes: generated.cookMinutes,
      equipment: generated.equipment,
      ingredients: generated.ingredients,
      steps: generated.steps,
      tips: generated.tips,
      tags: generated.tags,
      nutritionPerServing: generated.nutritionPerServing,
      // No image provider is configured, so there is no image. The detail
      // screen draws a labelled placeholder rather than inventing a photo.
      image: null,
      sourceRequest: request,
    });

    if (!created.ok) {
      setError(created.error);
      return;
    }

    rememberChoices();
    router.replace(`/recipe/${created.value.id}`);
  };

  const submit = async () => {
    setSubmitted(true);
    if (hasErrors) return;

    setBusy(true);
    setError(null);

    const request = buildRequest();
    const result = await generateRecipe({
      request,
      accessToken: session?.access_token ?? null,
    });

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    await saveAndOpen(result.value, request);
    setBusy(false);
  };

  const openDemo = async () => {
    setSubmitted(true);
    // The demo still needs a sensible request to pick from, but it does not
    // need the prompt to be valid.
    setBusy(true);
    setError(null);
    const request = buildRequest();
    await saveAndOpen(generateDemoRecipe(request), request);
    setBusy(false);
  };

  return (
    <Screen
      title="Create a recipe"
      contentStyle={{ gap: theme.spacing.xl }}
      footer={
        <>
          {submitted && hasErrors ? (
            <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
              {promptError ?? cuisineNoteError}
            </Text>
          ) : null}

          {availability.available ? (
            <Button
              label="Write me this recipe"
              onPress={() => void submit()}
              loading={busy}
              size="lg"
              fullWidth
              haptic
              leading={<Icon name="sparkle" size={20} color={theme.colors.textOnPrimary} />}
            />
          ) : null}

          <Button
            label="Open a demo recipe instead"
            variant={availability.available ? 'ghost' : 'primary'}
            size={availability.available ? 'md' : 'lg'}
            onPress={() => void openDemo()}
            loading={busy && !availability.available}
            fullWidth
            accessibilityHint="Opens a bundled example recipe, clearly labelled as a demo"
          />
        </>
      }
    >
      {!availability.available ? (
        <Disclosure
          summary="Recipe writing is not set up in this build"
          detail={`${availability.reason} The demo button below opens a real, followable recipe from a small bundled set, labelled as a demo throughout. It is not written for your request.`}
          tone="caution"
        />
      ) : null}

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? () => void submit() : undefined}
          retryLabel="Try again"
        />
      ) : null}

      {mode === 'from_photo' && photoUri ? (
        <Section title="Your photo" dense>
          <RecipeImage
            image={{ uri: photoUri, kind: 'user_photo', attribution: null }}
            title="Your photo"
            height={160}
          />
          <Disclosure
            summary="FoodLens will work out the dish from this photo"
            detail="A photo cannot reveal hidden ingredients or the original method, so the recipe is a close guess at the dish rather than the same one."
          />
        </Section>
      ) : (
        <Section title="How do you want to ask?" dense>
          <SegmentedControl
            options={MODE_OPTIONS}
            value={mode === 'from_photo' ? 'dish_name' : mode}
            onChange={setMode}
            accessibilityLabel="How to describe what you want to cook"
          />
        </Section>
      )}

      <TextField
        label={hints.label}
        value={prompt}
        onChangeText={setPrompt}
        placeholder={hints.placeholder}
        help={hints.help}
        error={submitted && mode !== 'from_pantry' ? promptError : null}
        autoCapitalize="sentences"
        multiline={mode === 'description'}
        numberOfLines={mode === 'description' ? 3 : 1}
      />

      {mode === 'from_pantry' || pantryIngredients.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <TextField
            label="Ingredients you already have"
            value={pantryText}
            onChangeText={setPantryText}
            placeholder="rice, eggs, onions, tomatoes"
            help="Separate them with commas. FoodLens will try to use these and add as little as possible."
            error={submitted && mode === 'from_pantry' ? promptError : null}
            autoCapitalize="none"
            multiline
            numberOfLines={3}
          />
          {pantryIngredients.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {pantryIngredients.map((item) => (
                <Badge key={item} label={item} tone="primary" />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <Section title="How many servings?" dense>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, alignItems: 'center' }}>
          {SERVING_PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={String(preset)}
              selected={servings === preset}
              onPress={() => setServings(preset)}
            />
          ))}
          <Stepper
            value={servings}
            onChange={setServings}
            min={MIN_SERVINGS}
            max={MAX_SERVINGS}
            label="Servings"
            unitLabel={servings === 1 ? 'serving' : 'servings'}
          />
        </View>
      </Section>

      <Section title="Cuisine" dense>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {CUISINE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={cuisine === option.value}
              onPress={() => setCuisine(cuisine === option.value ? null : option.value)}
            />
          ))}
        </View>
        {cuisine === 'other' ? (
          <TextField
            label="Which style?"
            value={cuisineNote}
            onChangeText={setCuisineNote}
            placeholder="Georgian, Goan, my grandmother's"
            error={submitted ? cuisineNoteError : null}
            autoCapitalize="sentences"
          />
        ) : null}
      </Section>

      <Section title="Time you have" dense>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {TIME_OPTIONS.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={maxMinutes === option.value}
              onPress={() => setMaxMinutes(option.value)}
            />
          ))}
        </View>
      </Section>

      <Section
        title="What you can cook with"
        subtitle="Leave empty and we assume a basic kitchen."
        dense
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {EQUIPMENT_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={equipment.includes(option)}
              onPress={() =>
                setEquipment((current) =>
                  current.includes(option)
                    ? current.filter((entry) => entry !== option)
                    : [...current, option],
                )
              }
            />
          ))}
        </View>
      </Section>

      <DietarySummary />
    </Screen>
  );
}

/**
 * What the recipe will respect, taken from saved preferences.
 *
 * Shown rather than applied invisibly: Food Memory should be inspectable.
 * The allergy caveat has to appear wherever allergies affect the output, and
 * it does - as one line that expands, not as a stacked warning panel.
 */
function DietarySummary() {
  const theme = useTheme();
  const router = useRouter();
  const preferences = usePreferencesStore((state) => state.preferences);

  const hasPatterns = preferences.dietaryPatterns.length > 0;
  const hasAllergens =
    preferences.allergyAwarenessEnabled && preferences.allergens.length > 0;

  if (!hasPatterns && !hasAllergens) {
    return (
      <Section
        title="No dietary preferences saved"
        subtitle="Tell FoodLens how you eat and recipes will respect it without you repeating yourself."
        dense
      >
        <Button
          label="Set my preferences"
          variant="tonal"
          size="sm"
          onPress={() => router.push('/(onboarding)/food')}
        />
      </Section>
    );
  }

  return (
    <Section
      title="This recipe will respect"
      action={{ label: 'Change', onPress: () => router.push('/(onboarding)/food') }}
      dense
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {preferences.dietaryPatterns.map((pattern) => (
          <Badge key={pattern} label={pattern.replace(/_/g, ' ')} tone="primary" />
        ))}
        {hasAllergens
          ? preferences.allergens.map((allergen) => (
              <Badge key={allergen} label={`no ${allergen}`} tone="warning" />
            ))
          : null}
      </View>

      {hasAllergens ? (
        <Disclosure
          summary="Filtering allergens is not a safety check"
          detail="FoodLens asks the model to leave these out, but AI output can be wrong or incomplete. Never rely on a generated recipe to decide whether something is safe for an allergy. Read the labels on what you actually buy."
          tone="caution"
        />
      ) : null}
    </Section>
  );
}
