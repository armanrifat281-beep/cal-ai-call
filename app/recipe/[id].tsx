import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  ErrorState,
  InfoNote,
  Screen,
  Skeleton,
  Stepper,
  Text,
} from '@/components/ui';
import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  batchNutrition,
  checkRecipeConsistency,
  describeConsistencyIssue,
  formatIngredientAmount,
  getRecipeRepository,
  getShoppingListRepository,
  scaleRecipe,
  useRecipe,
} from '@/features/recipes';
import { cuisineLabel } from '@/features/recipes/options';
import { SOURCE_EXPLANATIONS, SOURCE_LABELS, formatCalories, formatGrams } from '@/features/nutrition';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';
import type { ScaledIngredient } from '@/features/recipes';

/**
 * One recipe: what it is, what you need, and how to cook it.
 *
 * The ingredient checklist is the working part of this screen. Ticking an
 * ingredient means "I have this"; everything unticked is what the shopping
 * list is built from. Nothing is pre-ticked - assuming an ingredient is in
 * someone's cupboard is how a shopping list ends up missing it.
 */
export default function RecipeDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { recipe, loading, error, notFound, reload } = useRecipe(id);

  const [servings, setServings] = useState<number | null>(null);
  /** Ids the user has ticked as already owned, for this visit. */
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<AppError | null>(null);

  const targetServings = servings ?? recipe?.servings ?? 4;

  const scaled = useMemo(
    () => (recipe ? scaleRecipe(recipe, targetServings) : null),
    [recipe, targetServings],
  );

  const consistency = useMemo(
    () => (recipe ? checkRecipeConsistency(recipe) : null),
    [recipe],
  );

  const missing = useMemo(
    () => (scaled ? scaled.ingredients.filter((item) => !owned.has(item.id)) : []),
    [scaled, owned],
  );

  const toggleOwned = useCallback((ingredientId: string) => {
    setOwned((current) => {
      const next = new Set(current);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  }, []);

  const addMissingToList = async () => {
    if (!recipe || missing.length === 0) return;

    setBusy(true);
    setActionError(null);

    const repository = getShoppingListRepository();
    const items = missing.map((item) => ({
      name: item.name,
      // The scaled amount, so the list matches the servings being cooked.
      quantity: item.scaledQuantity,
      unit: item.unit,
      note: item.preparation,
      sourceRecipeId: recipe.id,
    }));

    // Add to the newest active list if there is one, so a second recipe
    // merges into the same shop rather than starting another list.
    const existing = await repository.listLists('active');
    const target = existing.ok ? existing.value[0] : undefined;

    const result = target
      ? await repository.addItems(target.id, items)
      : await repository.createList({ name: 'Shopping list', items });

    setBusy(false);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    router.push(`/shopping/${result.value.id}`);
  };

  const toggleFavorite = async () => {
    if (!recipe) return;
    setBusy(true);
    const result = await getRecipeRepository().setFavorite(recipe.id, !recipe.isFavorite);
    setBusy(false);
    if (!result.ok) setActionError(result.error);
    else reload();
  };

  const reject = () => {
    if (!recipe) return;
    Alert.alert(
      'Not interested in this recipe?',
      'It stays in your recipes so you can find it, but FoodLens will stop suggesting it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop suggesting it',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const result = await getRecipeRepository().setRejected(recipe.id, true);
              setBusy(false);
              if (!result.ok) setActionError(result.error);
              else router.back();
            })();
          },
        },
      ],
    );
  };

  const remove = () => {
    if (!recipe) return;
    Alert.alert(
      'Delete this recipe?',
      'It will be removed from your recipes. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const result = await getRecipeRepository().deleteRecipe(recipe.id);
              setBusy(false);
              if (!result.ok) setActionError(result.error);
              else router.back();
            })();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen contentStyle={{ gap: theme.spacing.base }}>
        <Skeleton height={190} radius={theme.radius.lg} />
        <Skeleton width="70%" height={28} />
        <Skeleton height={60} />
        <Skeleton height={120} radius={theme.radius.lg} />
      </Screen>
    );
  }

  if (notFound) {
    return (
      <Screen>
        <ErrorState
          title="Recipe not found"
          message="This recipe is no longer saved. It may have been deleted."
          onRetry={() => router.back()}
          retryLabel="Go back"
        />
      </Screen>
    );
  }

  if (error || !recipe || !scaled) {
    return (
      <Screen>
        <ErrorState
          message={error?.message ?? 'We could not open this recipe.'}
          detail={error?.detail}
          onRetry={reload}
        />
      </Screen>
    );
  }

  navigation.setOptions({ title: recipe.title });

  const isDemo = recipe.origin === 'demo_sample';
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const nutrition = scaled.nutritionPerServing;

  return (
    <Screen
      contentStyle={{ gap: theme.spacing.lg }}
      footer={
        <>
          <Button
            label="Start cooking"
            onPress={() => router.push(`/recipe/cook/${recipe.id}`)}
            size="lg"
            fullWidth
            haptic
            leading={<Icon name="flame" size={20} color={theme.colors.textOnPrimary} />}
          />
          {missing.length > 0 ? (
            <Button
              label={`Add ${missing.length} missing item${missing.length === 1 ? '' : 's'} to a shopping list`}
              variant="secondary"
              onPress={() => void addMissingToList()}
              loading={busy}
              fullWidth
            />
          ) : (
            <Text variant="caption" color="textMuted" align="center">
              You have everything. Nothing to buy.
            </Text>
          )}
        </>
      }
    >
      {isDemo ? (
        <InfoNote
          title="This is a demo recipe"
          body="It came from a small bundled set, not from AI, and it was not written for your request. It is a real recipe you can cook, but its nutrition figures are rough demo values."
          tone="warning"
        />
      ) : null}

      {actionError ? (
        <ErrorState message={actionError.message} detail={actionError.detail} />
      ) : null}

      <RecipeImage image={recipe.image} title={recipe.title} />

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title">{recipe.title}</Text>
        {recipe.description ? (
          <Text variant="body" color="textMuted">
            {recipe.description}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {isDemo ? <Badge label="Demo recipe" tone="warning" /> : null}
          {cuisineLabel(recipe.cuisine) ? (
            <Badge label={cuisineLabel(recipe.cuisine) ?? ''} tone="neutral" />
          ) : null}
          {recipe.prepMinutes ? (
            <Badge label={`${recipe.prepMinutes} min prep`} tone="neutral" />
          ) : null}
          {recipe.cookMinutes ? (
            <Badge label={`${recipe.cookMinutes} min cook`} tone="neutral" />
          ) : null}
          {recipe.cookCount > 0 ? (
            <Badge
              label={`Cooked ${recipe.cookCount} time${recipe.cookCount === 1 ? '' : 's'}`}
              tone="primary"
            />
          ) : null}
        </View>
      </View>

      {consistency && !consistency.isConsistent ? (
        <InfoNote
          title="Check this recipe before you cook"
          body={consistency.issues.map(describeConsistencyIssue).join(' ')}
          tone="warning"
        />
      ) : null}

      {/* ---- Servings ---- */}
      <Card style={{ gap: theme.spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ gap: theme.spacing.xxs }}>
            <Text variant="bodySmStrong" color="textMuted">
              SERVINGS
            </Text>
            <Text variant="caption" color="textMuted">
              Written for {recipe.servings}
              {totalMinutes > 0 ? ` - about ${totalMinutes} min total` : ''}
            </Text>
          </View>
          <Stepper
            value={targetServings}
            onChange={setServings}
            min={MIN_SERVINGS}
            max={MAX_SERVINGS}
            label="Servings"
          />
        </View>

        {scaled.factor !== 1 ? (
          <Text variant="caption" color="primaryOnSoft">
            Amounts below are adjusted for {targetServings} servings.
          </Text>
        ) : null}

        {scaled.hasHeldIngredients ? (
          <Text variant="caption" color="textMuted">
            Some amounts do not change with servings, because they depend on
            your pan rather than how many people are eating.
          </Text>
        ) : null}
      </Card>

      {/* ---- Nutrition ---- */}
      {nutrition ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text variant="bodySmStrong" color="textMuted">
              PER SERVING
            </Text>
            <Badge
              label={SOURCE_LABELS[nutrition.source]}
              tone={nutrition.source === 'demo_sample' ? 'neutral' : 'warning'}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
            <NutrientCell label="Calories" value={formatCalories(nutrition.caloriesKcal)} />
            <NutrientCell label="Protein" value={formatGrams(nutrition.proteinG)} />
            <NutrientCell label="Carbs" value={formatGrams(nutrition.carbsG)} />
            <NutrientCell label="Fat" value={formatGrams(nutrition.fatG)} />
          </View>

          {targetServings !== recipe.servings ? (
            <Text variant="caption" color="textMuted">
              These are per serving, so they do not change when you adjust the
              serving count. The whole batch at {targetServings} servings comes
              to about{' '}
              {formatCalories(batchNutrition(nutrition, targetServings)?.caloriesKcal ?? null)}.
            </Text>
          ) : null}

          <InfoNote body={SOURCE_EXPLANATIONS[nutrition.source]} tone="neutral" />
        </Card>
      ) : (
        <InfoNote
          title="No nutrition estimate"
          body="This recipe has no nutrition figures. That is more honest than a number nobody stands behind - log the meal from your journal if you want to track it."
          tone="neutral"
        />
      )}

      {/* ---- Ingredient checklist ---- */}
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="heading">Ingredients</Text>
          <Text variant="bodySm" color="textMuted">
            Tick what you already have. Everything left is what you need to buy.
          </Text>
        </View>

        <Card padding="none">
          {groupIngredients(scaled.ingredients).map((group, groupIndex) => (
            <View key={group.name ?? `group-${groupIndex}`}>
              {group.name ? (
                <View
                  style={{
                    paddingHorizontal: theme.spacing.base,
                    paddingTop: theme.spacing.md,
                    paddingBottom: theme.spacing.xs,
                  }}
                >
                  <Text variant="caption" color="textMuted">
                    {group.name.toUpperCase()}
                  </Text>
                </View>
              ) : null}

              {group.items.map((item, index) => (
                <View key={item.id}>
                  {index > 0 || group.name ? <Divider inset={theme.spacing.base} /> : null}
                  <IngredientRow
                    item={item}
                    checked={owned.has(item.id)}
                    onToggle={() => toggleOwned(item.id)}
                  />
                </View>
              ))}
            </View>
          ))}
        </Card>

        {missing.length > 0 && missing.length < scaled.ingredients.length ? (
          <Text variant="bodySm" color="textMuted">
            {missing.length} still needed, {scaled.ingredients.length - missing.length}{' '}
            already in your kitchen.
          </Text>
        ) : null}
      </View>

      {/* ---- Equipment ---- */}
      {recipe.equipment.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="heading">You will need</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {recipe.equipment.map((item) => (
              <Badge key={item} label={item} tone="neutral" />
            ))}
          </View>
        </View>
      ) : null}

      {/* ---- Method ---- */}
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="heading">Method</Text>
        {recipe.steps.map((step) => (
          <Card key={step.number} style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="caption" color="primaryOnSoft">
                  {step.number}
                </Text>
              </View>
              {step.durationMinutes ? (
                <Badge label={`${step.durationMinutes} min`} tone="neutral" />
              ) : null}
              {step.temperatureC ? (
                <Badge label={`${step.temperatureC} C`} tone="accent" />
              ) : null}
            </View>
            <Text variant="body">{step.instruction}</Text>
          </Card>
        ))}
      </View>

      {/* ---- Tips ---- */}
      {recipe.tips.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="heading">Tips</Text>
          {recipe.tips.map((tip) => (
            <Card key={tip} variant="soft">
              <Text variant="bodySm">{tip}</Text>
            </Card>
          ))}
        </View>
      ) : null}

      {/* ---- Recipe actions ---- */}
      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label={recipe.isFavorite ? 'Remove from favourites' : 'Save to favourites'}
          variant="secondary"
          onPress={() => void toggleFavorite()}
          fullWidth
        />
        <Button
          label="Stop suggesting this"
          variant="ghost"
          size="sm"
          onPress={reject}
          fullWidth
        />
        <Button
          label="Delete this recipe"
          variant="ghost"
          size="sm"
          onPress={remove}
          fullWidth
        />
      </View>
    </Screen>
  );
}

function NutrientCell({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <Text variant="caption" color="textMuted">
        {label.toUpperCase()}
      </Text>
      <Text variant="metricSm">{value}</Text>
    </View>
  );
}

function IngredientRow({
  item,
  checked,
  onToggle,
}: {
  item: ScaledIngredient;
  checked: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  const detailParts = [item.displayAmount, item.preparation].filter(
    (part): part is string => Boolean(part && part.length > 0),
  );

  return (
    <View>
      <Checkbox
        checked={checked}
        onChange={onToggle}
        label={item.name}
        detail={detailParts.join(' - ')}
        trailing={
          item.wasHeldFixed ? (
            <Badge label="fixed" tone="neutral" />
          ) : undefined
        }
      />
      {item.substitution ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.base + 36,
            paddingBottom: theme.spacing.sm,
          }}
        >
          <Text variant="caption" color="textMuted">
            Or: {item.substitution}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Groups ingredients by their section, keeping ungrouped ones first. */
function groupIngredients(
  ingredients: ScaledIngredient[],
): { name: string | null; items: ScaledIngredient[] }[] {
  const ungrouped = ingredients.filter((item) => !item.group);
  const groupNames = [
    ...new Set(
      ingredients
        .map((item) => item.group)
        .filter((group): group is string => Boolean(group)),
    ),
  ];

  const groups: { name: string | null; items: ScaledIngredient[] }[] = [];
  if (ungrouped.length > 0) groups.push({ name: null, items: ungrouped });
  for (const name of groupNames) {
    groups.push({ name, items: ingredients.filter((item) => item.group === name) });
  }
  return groups;
}

/** Re-exported so the formatter is available to other recipe screens. */
export { formatIngredientAmount };
