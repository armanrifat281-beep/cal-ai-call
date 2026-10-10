import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import {
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import {
  getRecipeRepository,
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

  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [showIngredients, setShowIngredients] = useState(false);
  const [finishing, setFinishing] = useState(false);

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
    const result = await getRecipeRepository().recordCooked(recipe.id);
    setFinishing(false);
    if (!result.ok) {
      // Not worth blocking on: they finished cooking either way.
      router.back();
      return;
    }
    router.back();
  };

  if (loading) {
    return (
      <Screen edges={{ top: true }} contentStyle={{ gap: theme.spacing.base }}>
        <Skeleton width="50%" height={20} />
        <Skeleton height={160} radius={theme.radius.lg} />
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
          <Text variant="caption" color="textMuted">
            STEP {step.number} OF {steps.length}
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
          <Card padding="none" style={{ overflow: 'hidden' }}>
            <View style={{ padding: theme.spacing.base, gap: theme.spacing.xxs }}>
              <Text variant="bodySmStrong" color="textMuted">
                EVERYTHING IN THIS RECIPE
              </Text>
              <Text variant="caption" color="textMuted">
                For {recipe.servings} servings
              </Text>
            </View>
            {scaled.ingredients.map((ingredient, index) => (
              <View key={ingredient.id}>
                {index > 0 ? <Divider inset={theme.spacing.base} /> : null}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: theme.spacing.md,
                    paddingHorizontal: theme.spacing.base,
                    paddingVertical: theme.spacing.sm,
                  }}
                >
                  <Text variant="bodySm" style={{ flex: 1 }}>
                    {ingredient.name}
                  </Text>
                  <Text variant="bodySmStrong" color="textMuted">
                    {ingredient.displayAmount}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {/* The ingredients this step needs, so there is no scrolling back. */}
        {stepIngredients.length > 0 ? (
          <Card variant="soft" style={{ gap: theme.spacing.sm }}>
            <Text variant="caption" color="textMuted">
              FOR THIS STEP
            </Text>
            {stepIngredients.map((ingredient) => (
              <View
                key={ingredient.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}
              >
                <Text variant="body" style={{ flex: 1 }}>
                  {ingredient.name}
                  {ingredient.preparation ? (
                    <Text variant="bodySm" color="textMuted">
                      {`, ${ingredient.preparation}`}
                    </Text>
                  ) : null}
                </Text>
                <Text variant="bodyStrong">{ingredient.displayAmount}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          {step.durationMinutes ? (
            <Badge
              label={`${step.durationMinutes} min`}
              tone="primary"
              leading={<Icon name="timer" size={14} color="primaryOnSoft" />}
            />
          ) : null}
          {step.temperatureC ? (
            <Badge
              label={`${step.temperatureC} C`}
              tone="accent"
              leading={<Icon name="flame" size={14} color="accentOnSoft" />}
            />
          ) : null}
        </View>

        {/* Large type: this is read from across a worktop. */}
        <Pressable
          onPress={isLastStep ? undefined : goNext}
          accessibilityRole={isLastStep ? undefined : 'button'}
          accessibilityLabel={isLastStep ? undefined : 'Next step'}
          accessibilityHint={isLastStep ? undefined : 'Marks this step done and moves on'}
          style={{ flex: 1 }}
        >
          <Text variant="heading" style={{ fontSize: 24, lineHeight: 34 }}>
            {step.instruction}
          </Text>
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
              borderRadius: theme.radius.sm,
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
          <Text variant="bodySm" color="textMuted">
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
          variant="secondary"
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
