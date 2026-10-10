import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Button, ErrorState, Screen, Skeleton, Surface, Text } from '@/components/ui';
import {
  CookedScreen,
  StepTimer,
  useRecipeRepository,
  scaleRecipe,
  useRecipe,
} from '@/features/recipes';
import { useTheme } from '@/theme';

/**
 * Cooking mode.
 *
 * One step at a time, large type, and the ingredients for that step right
 * there. Designed to be read at arm's length with messy hands: no header, big
 * hit targets, and the whole step area is tappable to advance.
 *
 * The point is that nobody should have to scroll a chat transcript to find
 * out what to do next.
 */
export default function CookingModeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { recipe, loading, error, notFound, reload } = useRecipe(id);
  const recipes = useRecipeRepository();

  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [showIngredients, setShowIngredients] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [cooked, setCooked] = useState(false);

  const scaled = useMemo(
    () => (recipe ? scaleRecipe(recipe, recipe.servings) : null),
    [recipe],
  );

  const steps = recipe?.steps ?? [];
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const stepIngredients = useMemo(() => {
    if (!step || !scaled) return [];
    return scaled.ingredients.filter((ingredient) =>
      step.ingredientIds.includes(ingredient.id),
    );
  }, [step, scaled]);

  const toggleCompleted = useCallback((number: number) => {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  }, []);

  const goNext = useCallback(() => {
    if (!step) return;
    // Advancing marks the step done: that is what "next" means while cooking.
    setCompleted((current) => new Set(current).add(step.number));
    setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  }, [step, steps.length]);

  const goPrevious = useCallback(() => {
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  const finish = async () => {
    if (!recipe) return;
    setFinishing(true);
    // Recorded so "Cook it again" reflects what the user actually cooked.
    // A failure here is not worth blocking on: they finished cooking either
    // way, and the screen that follows is the reward for it.
    await recipes.recordCooked(recipe.id);
    setFinishing(false);
    setCooked(true);
  };

  if (loading) {
    return (
      <Screen edges={{ top: true }} contentStyle={{ gap: theme.spacing.base }}>
        <Skeleton width="50%" height={20} />
        <Skeleton height={160} radius={theme.radius.surface} />
        <Skeleton height={56} />
      </Screen>
    );
  }

  if (notFound || error || !recipe || !step) {
    return (
      <Screen edges={{ top: true }}>
        <ErrorState
          title={notFound ? 'Recipe not found' : 'Could not open cooking mode'}
          message={
            notFound
              ? 'This recipe is no longer saved.'
              : (error?.message ?? 'This recipe has no steps to cook.')
          }
          onRetry={notFound ? () => router.back() : reload}
          retryLabel={notFound ? 'Go back' : 'Try again'}
        />
      </Screen>
    );
  }

  if (cooked) {
    return (
      <CookedScreen recipe={recipe} onDone={() => router.back()} />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      {/* ---- Top bar: exit, progress, ingredients ---- */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <Button
          label="Done"
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
          accessibilityHint="Leaves cooking mode and returns to the full recipe"
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="metricS" color="textMuted">
            Step {step.number} of {steps.length}
          </Text>
        </View>
        <Button
          label={showIngredients ? 'Hide' : 'Ingredients'}
          variant="ghost"
          size="sm"
          onPress={() => setShowIngredients((open) => !open)}
        />
      </View>

      {/* ---- Progress bar ---- */}
      <View
        style={{
          flexDirection: 'row',
          gap: 3,
          paddingHorizontal: theme.spacing.base,
          paddingBottom: theme.spacing.md,
        }}
      >
        {steps.map((entry, index) => (
          <Pressable
            key={entry.number}
            onPress={() => setStepIndex(index)}
            accessibilityRole="button"
            accessibilityLabel={`Go to step ${entry.number}`}
            hitSlop={8}
            style={{ flex: 1 }}
          >
            <View
              style={{
                height: 5,
                borderRadius: 3,
                backgroundColor: completed.has(entry.number)
                  ? theme.colors.primary
                  : index === stepIndex
                    ? theme.colors.primaryOnSoft
                    : theme.colors.surfaceAlt,
              }}
            />
          </Pressable>
        ))}
      </View>

      {/* ---- The step ---- */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: theme.spacing.base,
          gap: theme.spacing.lg,
          flexGrow: 1,
        }}
      >
        {showIngredients && scaled ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
            <Surface variant="grouped">
              <View style={{ padding: theme.spacing.base, gap: 2 }}>
                <Text variant="label">Everything in this recipe</Text>
                <Text variant="caption" color="textMuted">
                  For {recipe.servings} servings
                </Text>
              </View>
              {scaled.ingredients.map((ingredient) => (
                <View
                  key={ingredient.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: theme.spacing.md,
                    paddingHorizontal: theme.spacing.base,
                    paddingVertical: theme.spacing.sm,
                    borderTopWidth: theme.hairline,
                    borderTopColor: theme.colors.separator,
                  }}
                >
                  <Text variant="callout" style={{ flex: 1 }}>
                    {ingredient.name}
                  </Text>
                  <Text variant="metricS" color="textMuted">
                    {ingredient.displayAmount}
                  </Text>
                </View>
              ))}
            </Surface>
          </Animated.View>
        ) : null}

        {/* The ingredients this step needs, so there is no scrolling back. */}
        {stepIngredients.length > 0 ? (
          <Surface variant="sunken" padding="base" style={{ gap: theme.spacing.sm }}>
            <Text variant="label" color="textMuted">
              For this step
            </Text>
            {stepIngredients.map((ingredient) => (
              <View
                key={ingredient.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                }}
              >
                <Text variant="body" style={{ flex: 1 }}>
                  {ingredient.name}
                  {ingredient.preparation ? (
                    <Text variant="callout" color="textMuted">
                      {`, ${ingredient.preparation}`}
                    </Text>
                  ) : null}
                </Text>
                <Text variant="metricM">{ingredient.displayAmount}</Text>
              </View>
            ))}
          </Surface>
        ) : null}

        {step.temperatureC ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="flame" size={16} color="accent" strokeWidth={1.7} />
            <Text variant="metricM" color="accentOnSoft">
              {step.temperatureC}°C
            </Text>
          </View>
        ) : null}

        {/*
          Keyed on the step, so moving on gives the next step its own timer
          rather than carrying the previous one's clock forward.
        */}
        {step.durationMinutes ? (
          <StepTimer key={step.number} minutes={step.durationMinutes} />
        ) : null}

        {/* Large type: this is read from across a worktop. */}
        <Pressable
          onPress={isLastStep ? undefined : goNext}
          accessibilityRole={isLastStep ? undefined : 'button'}
          accessibilityLabel={isLastStep ? undefined : 'Next step'}
          accessibilityHint={isLastStep ? undefined : 'Marks this step done and moves on'}
          style={{ flex: 1 }}
        >
          {/*
            Keyed on the step so each instruction cross-fades in. Swapping
            the text in place gives no sense of having moved forward.
          */}
          <Animated.View key={step.number} entering={FadeIn.duration(180)}>
            <Text variant="title1" style={{ fontSize: 26, lineHeight: 35 }}>
              {step.instruction}
            </Text>
          </Animated.View>
        </Pressable>

        <Pressable
          onPress={() => toggleCompleted(step.number)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: completed.has(step.number) }}
          accessibilityLabel={`Mark step ${step.number} as done`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: theme.radius.xs,
              borderWidth: completed.has(step.number) ? 0 : 2,
              borderColor: theme.colors.borderStrong,
              backgroundColor: completed.has(step.number)
                ? theme.colors.primary
                : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {completed.has(step.number) ? (
              <Icon name="check" size={17} color={theme.colors.textOnPrimary} strokeWidth={2.6} />
            ) : null}
          </View>
          <Text variant="callout" color="textMuted">
            {completed.has(step.number) ? 'Done' : 'Mark this step done'}
          </Text>
        </Pressable>
      </ScrollView>

      {/* ---- Navigation ---- */}
      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.base,
          paddingBottom: theme.spacing.base + insets.bottom,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Button
          label="Back"
          variant="tonal"
          size="lg"
          onPress={goPrevious}
          disabled={stepIndex === 0}
          style={{ flex: 1 }}
          leading={<Icon name="chevronLeft" size={18} color="text" />}
        />
        {isLastStep ? (
          <Button
            label="Finish"
            size="lg"
            onPress={() => void finish()}
            loading={finishing}
            haptic
            style={{ flex: 1.4 }}
            leading={<Icon name="check" size={18} color={theme.colors.textOnPrimary} />}
          />
        ) : (
          <Button
            label="Next step"
            size="lg"
            onPress={goNext}
            haptic
            style={{ flex: 1.4 }}
            trailing={<Icon name="chevronRight" size={18} color={theme.colors.textOnPrimary} />}
          />
        )}
      </View>
    </View>
  );
}
