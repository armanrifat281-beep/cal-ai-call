import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import {
  Button,
  Disclosure,
  ErrorState,
  IconButton,
  Metric,
  PressableScale,
  Screen,
  Section,
  Skeleton,
  Stepper,
  Surface,
  Text,
} from '@/components/ui';
import { SOURCE_EXPLANATIONS, formatGrams } from '@/features/nutrition';
import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  batchNutrition,
  checkRecipeConsistency,
  describeConsistencyIssue,
  getRecipeRepository,
  getShoppingListRepository,
  scaleRecipe,
  useRecipe,
  type ScaledIngredient,
} from '@/features/recipes';
import { cuisineLabel } from '@/features/recipes/options';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';

/**
 * One recipe.
 *
 * Reworked from a stack of five outlined cards and four warning panels into
 * a single reading flow: image, title, the facts as one line of text, then
 * ingredients as a checklist and the method as a numbered rail.
 *
 * The ingredient checklist is the working part. Ticking means "I have this";
 * whatever is left is what the shopping list is built from. Nothing is
 * pre-ticked.
 */
export default function RecipeDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { recipe, loading, error, notFound, reload } = useRecipe(id);

  const [servings, setServings] = useState<number | null>(null);
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

  const toggleFavorite = useCallback(async () => {
    if (!recipe) return;
    setBusy(true);
    const result = await getRecipeRepository().setFavorite(recipe.id, !recipe.isFavorite);
    setBusy(false);
    if (!result.ok) setActionError(result.error);
    else reload();
  }, [recipe, reload]);

  const showMore = useCallback(() => {
    if (!recipe) return;
    Alert.alert(recipe.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop suggesting this',
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
      {
        text: 'Delete recipe',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete this recipe?', 'This cannot be undone.', [
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
          ]);
        },
      },
    ]);
  }, [recipe, router]);

  // Favourite and overflow live in the navigation bar, which is where a
  // native app puts them. Earlier this screen ended with three stacked
  // full-width ghost buttons.
  useEffect(() => {
    if (!recipe) return;
    navigation.setOptions({
      title: recipe.title,
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 2, marginRight: -6 }}>
          <IconButton
            accessibilityLabel={
              recipe.isFavorite ? 'Remove from favourites' : 'Save to favourites'
            }
            onPress={() => void toggleFavorite()}
          >
            <Icon
              name="star"
              size={21}
              color={recipe.isFavorite ? 'accent' : 'textMuted'}
              filled={recipe.isFavorite}
            />
          </IconButton>
          <IconButton accessibilityLabel="More actions" onPress={showMore}>
            <Icon name="more" size={21} color="textMuted" />
          </IconButton>
        </View>
      ),
    });
  }, [recipe, navigation, toggleFavorite, showMore]);

  const addMissingToList = async () => {
    if (!recipe || missing.length === 0) return;

    setBusy(true);
    setActionError(null);

    const repository = getShoppingListRepository();
    const items = missing.map((item) => ({
      name: item.name,
      quantity: item.scaledQuantity,
      unit: item.unit,
      note: item.preparation,
      sourceRecipeId: recipe.id,
    }));

    // Merge into the newest active list, so a second recipe joins the same
    // shop rather than starting another list.
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

  if (loading) {
    return (
      <Screen contentStyle={{ gap: theme.spacing.lg }}>
        <Skeleton height={200} radius={theme.radius.media} />
        <Skeleton width="70%" height={28} />
        <Skeleton width="45%" height={14} />
        <Skeleton height={60} />
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

  const isDemo = recipe.origin === 'demo_sample';
  const nutrition = scaled.nutritionPerServing;

  // The facts as one line of plain text, separated by middots. These were
  // five coloured pills, which is a lot of visual noise for metadata.
  const facts = [
    `Serves ${recipe.servings}`,
    recipe.prepMinutes ? `${recipe.prepMinutes} min prep` : null,
    recipe.cookMinutes ? `${recipe.cookMinutes} min cook` : null,
    cuisineLabel(recipe.cuisine),
    recipe.cookCount > 0
      ? `cooked ${recipe.cookCount} time${recipe.cookCount === 1 ? '' : 's'}`
      : null,
  ].filter(Boolean);

  return (
    <Screen
      contentStyle={{ gap: theme.spacing.xl }}
      footer={
        <>
          <Button
            label="Start cooking"
            onPress={() => router.push(`/recipe/cook/${recipe.id}`)}
            size="lg"
            fullWidth
            leading={<Icon name="flame" size={19} color={theme.colors.textOnPrimary} />}
          />
          {missing.length > 0 ? (
            <Button
              label={`Add ${missing.length} missing to a list`}
              variant="tonal"
              onPress={() => void addMissingToList()}
              loading={busy}
              fullWidth
            />
          ) : scaled.ingredients.length > 0 ? (
            <Text variant="footnote" color="textMuted" align="center">
              You have everything.
            </Text>
          ) : null}
        </>
      }
    >
      {/* Full-bleed hero: the gutter is cancelled so the image meets the edges. */}
      <RecipeImage
        image={recipe.image}
        title={recipe.title}
        height={210}
        style={{
          marginHorizontal: -theme.gutter,
          marginTop: -theme.spacing.lg,
          borderRadius: 0,
        }}
      />

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title1">{recipe.title}</Text>
        {recipe.description ? (
          <Text variant="body" color="textMuted">
            {recipe.description}
          </Text>
        ) : null}
        <Text variant="footnote" color="textSubtle">
          {facts.join('  ·  ')}
        </Text>
      </View>

      {actionError ? (
        <ErrorState message={actionError.message} detail={actionError.detail} />
      ) : null}

      {/*
        Two caveats that have to be on this screen, as single lines rather
        than stacked panels: that a demo recipe is a demo, and anything the
        recipe says that contradicts itself.
      */}
      {isDemo ? (
        <Disclosure
          summary="Demo recipe, not written for your request"
          detail="This came from a small bundled set rather than from AI. It is a real recipe you can cook, but its nutrition figures are rough demo values."
          tone="caution"
        />
      ) : null}

      {consistency && !consistency.isConsistent ? (
        <Disclosure
          summary="Some amounts in this recipe do not add up"
          detail={consistency.issues.map(describeConsistencyIssue).join(' ')}
          tone="caution"
        />
      ) : null}

      {/* Servings. A labelled row, not a panel. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">Servings</Text>
          <Text variant="footnote" color="textMuted">
            {scaled.factor === 1
              ? 'As written'
              : `Amounts adjusted from ${recipe.servings}`}
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

      {/* Nutrition. Four figures in a row, no box. */}
      {nutrition ? (
        <Section title="Per serving" dense>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Metric
              value={String(Math.round(nutrition.caloriesKcal))}
              unit="kcal"
              label="Energy"
              size="l"
            />
            <Metric value={formatGrams(nutrition.proteinG)} label="Protein" size="m" />
            <Metric value={formatGrams(nutrition.carbsG)} label="Carbs" size="m" />
            <Metric value={formatGrams(nutrition.fatG)} label="Fat" size="m" />
          </View>

          <Disclosure
            summary={
              targetServings === recipe.servings
                ? 'These are estimates, per serving'
                : `Per serving, so unchanged at ${targetServings} servings`
            }
            detail={`${SOURCE_EXPLANATIONS[nutrition.source]}${
              targetServings !== recipe.servings
                ? ` The whole batch at ${targetServings} servings comes to about ${Math.round(
                    batchNutrition(nutrition, targetServings)?.caloriesKcal ?? 0,
                  )} kcal.`
                : ''
            }`}
          />
        </Section>
      ) : (
        <Disclosure
          summary="No nutrition estimate for this recipe"
          detail="That is more honest than a number nobody stands behind. Log the meal from your journal if you want to track it."
        />
      )}

      {/* Ingredients. */}
      <Section
        title="Ingredients"
        subtitle="Tick what you already have."
        dense
      >
        <Surface variant="grouped">
          {groupIngredients(scaled.ingredients).map((group, groupIndex) => (
            <View key={group.name ?? `g-${groupIndex}`}>
              {group.name ? (
                <View
                  style={{
                    paddingHorizontal: theme.spacing.base,
                    paddingTop: theme.spacing.md,
                    paddingBottom: theme.spacing.xs,
                    backgroundColor: theme.colors.surfaceAlt,
                  }}
                >
                  <Text variant="label" color="textMuted">
                    {group.name}
                  </Text>
                </View>
              ) : null}

              {group.items.map((item, index) => (
                <IngredientRow
                  key={item.id}
                  item={item}
                  checked={owned.has(item.id)}
                  onToggle={() => toggleOwned(item.id)}
                  divided={index > 0 || Boolean(group.name)}
                />
              ))}
            </View>
          ))}
        </Surface>

        {scaled.hasHeldIngredients ? (
          <Disclosure summary="Amounts marked “fixed” depend on your pan, not the serving count." />
        ) : null}
      </Section>

      {recipe.equipment.length > 0 ? (
        <Section title="You will need" dense>
          <Text variant="body" color="textMuted">
            {recipe.equipment.join(', ')}
          </Text>
        </Section>
      ) : null}

      {/* Method as a numbered rail. */}
      <Section title="Method" dense>
        <View>
          {recipe.steps.map((step, index) => (
            <MethodStep
              key={step.number}
              number={step.number}
              instruction={step.instruction}
              durationMinutes={step.durationMinutes}
              temperatureC={step.temperatureC}
              isLast={index === recipe.steps.length - 1}
            />
          ))}
        </View>
      </Section>

      {recipe.tips.length > 0 ? (
        <Section title="Tips" dense>
          <View style={{ gap: theme.spacing.md }}>
            {recipe.tips.map((tip) => (
              <View key={tip} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View
                  style={{
                    width: 3,
                    borderRadius: 2,
                    backgroundColor: theme.colors.primarySoft,
                  }}
                />
                <Text variant="callout" color="textMuted" style={{ flex: 1 }}>
                  {tip}
                </Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}

/**
 * One step on a vertical rail.
 *
 * The connecting line is what makes a sequence read as a sequence. Each step
 * used to be its own outlined card, which read as a list of unrelated notes.
 */
function MethodStep({
  number,
  instruction,
  durationMinutes,
  temperatureC,
  isLast,
}: {
  number: number;
  instruction: string;
  durationMinutes: number | null;
  temperatureC: number | null;
  isLast: boolean;
}) {
  const theme = useTheme();

  const meta = [
    durationMinutes ? `${durationMinutes} min` : null,
    temperatureC ? `${temperatureC}°C` : null,
  ].filter(Boolean);

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
      <View style={{ alignItems: 'center', width: 26 }}>
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
          <Text variant="metricS" color="primaryOnSoft">
            {number}
          </Text>
        </View>
        {!isLast ? (
          <View style={{ flex: 1, width: theme.hairline * 2, backgroundColor: theme.colors.separator }} />
        ) : null}
      </View>

      <View
        style={{
          flex: 1,
          gap: theme.spacing.xs,
          paddingBottom: isLast ? 0 : theme.spacing.lg,
        }}
      >
        <Text variant="body">{instruction}</Text>
        {meta.length > 0 ? (
          <Text variant="caption" color="textMuted">
            {meta.join('  ·  ')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function IngredientRow({
  item,
  checked,
  onToggle,
  divided,
}: {
  item: ScaledIngredient;
  checked: boolean;
  onToggle: () => void;
  divided: boolean;
}) {
  const theme = useTheme();

  const detail = [item.preparation, item.wasHeldFixed ? 'fixed' : null]
    .filter((part): part is string => Boolean(part))
    .join('  ·  ');

  return (
    <View>
      {divided ? (
        <View
          style={{
            height: theme.hairline,
            backgroundColor: theme.colors.separator,
            marginLeft: theme.spacing.base + 24 + theme.spacing.md,
          }}
        />
      ) : null}

      <View>
        <IngredientCheckbox
          checked={checked}
          onToggle={onToggle}
          name={item.name}
          amount={item.displayAmount}
          detail={detail}
        />
        {item.substitution ? (
          <Text
            variant="caption"
            color="textSubtle"
            style={{
              paddingLeft: theme.spacing.base + 24 + theme.spacing.md,
              paddingRight: theme.spacing.base,
              paddingBottom: theme.spacing.sm,
            }}
          >
            or {item.substitution}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * An ingredient line.
 *
 * The amount is right-aligned in tabular digits, so the quantities form a
 * readable column down the list rather than trailing each name.
 */
function IngredientCheckbox({
  checked,
  onToggle,
  name,
  amount,
  detail,
}: {
  checked: boolean;
  onToggle: () => void;
  name: string;
  amount: string;
  detail: string;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${name}${amount ? `, ${amount}` : ''}`}
      accessibilityHint={
        checked ? 'Marks this as not yet bought' : 'Marks this as already in your kitchen'
      }
      scaleTo={0.99}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: theme.minTouchTarget + 2,
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: theme.radius.xs,
            borderWidth: checked ? 0 : 1.5,
            borderColor: theme.colors.borderStrong,
            backgroundColor: checked ? theme.colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? (
            <Icon name="check" size={15} color={theme.colors.textOnPrimary} strokeWidth={2.8} />
          ) : null}
        </View>

        <View style={{ flex: 1, gap: 1 }}>
          <Text
            variant="body"
            color={checked ? 'textSubtle' : 'text'}
            style={checked ? { textDecorationLine: 'line-through' } : undefined}
          >
            {name}
          </Text>
          {detail ? (
            <Text variant="caption" color="textSubtle">
              {detail}
            </Text>
          ) : null}
        </View>

        <Text variant="metricS" color={checked ? 'textSubtle' : 'textMuted'}>
          {amount}
        </Text>
      </View>
    </PressableScale>
  );
}

/** Groups ingredients by section, keeping ungrouped ones first. */
function groupIngredients(
  ingredients: ScaledIngredient[],
): { name: string | null; items: ScaledIngredient[] }[] {
  const ungrouped = ingredients.filter((item) => !item.group);
  const names = [
    ...new Set(
      ingredients.map((item) => item.group).filter((group): group is string => Boolean(group)),
    ),
  ];

  const groups: { name: string | null; items: ScaledIngredient[] }[] = [];
  if (ungrouped.length > 0) groups.push({ name: null, items: ungrouped });
  for (const name of names) {
    groups.push({ name, items: ingredients.filter((item) => item.group === name) });
  }
  return groups;
}
