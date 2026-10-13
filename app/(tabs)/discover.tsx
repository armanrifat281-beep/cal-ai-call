import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import {
  Button,
  EmptyState,
  ErrorState,
  PressableScale,
  Screen,
  Section,
  Skeleton,
  Surface,
  Text,
} from '@/components/ui';
import { matchPantry, useRecipes } from '@/features/recipes';
import { CUISINE_OPTIONS, cuisineLabel } from '@/features/recipes/options';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import type { Recipe } from '@/types/recipe';

/** Enough to browse, few enough that nothing needs a second screen. */
const COOK_TONIGHT_LIMIT = 6;
const CUISINE_CHIPS = 10;

interface Cookable {
  recipe: Recipe;
  missingCount: number;
  total: number;
}

/**
 * Discover.
 *
 * Everything on this screen is computed from the user's own saved recipes
 * and their kitchen list. Nothing is fetched from an editorial feed, and
 * nothing is recommended by a model: this app has no recipe service behind
 * it, and a row of invented "trending" cards would be decoration pretending
 * to be data.
 *
 * What it can honestly do is rank what the user already has by how close it
 * is to cookable right now, which is the question someone opens a recipe
 * screen to ask at six in the evening.
 *
 * The cuisine row is navigation, not content: each one opens the creator
 * already set to that style, so a tap produces a real recipe rather than a
 * filtered list of nothing.
 */
export default function DiscoverScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { recipes, loading, error, reload } = useRecipes({ limit: 60 });
  const pantryItems = usePreferencesStore((state) => state.preferences.pantryItems);

  /**
   * The user's recipes, nearest-to-cookable first.
   *
   * Only meaningful with a kitchen list; without one every recipe is
   * equally far away, so the section hides rather than ranking by nothing.
   */
  const cookable = useMemo<Cookable[]>(() => {
    if (pantryItems.length === 0) return [];

    return recipes
      .map((recipe) => {
        const match = matchPantry(recipe.ingredients, pantryItems);
        return {
          recipe,
          missingCount: match.missing.length,
          total: match.available.length + match.missing.length,
        };
      })
      .filter((entry) => entry.total > 0 && entry.missingCount < entry.total)
      .sort((a, b) => a.missingCount - b.missingCount)
      .slice(0, COOK_TONIGHT_LIMIT);
  }, [recipes, pantryItems]);

  const favourites = useMemo(
    () => recipes.filter((recipe) => recipe.isFavorite).slice(0, 6),
    [recipes],
  );

  return (
    <Screen
      title="Discover"
      subtitle="Your recipes, and what to do with what you have"
      edges={{ top: true }}
      refreshing={loading}
      onRefresh={reload}
      contentStyle={{ gap: theme.spacing.lg }}
    >
      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? reload : undefined}
        />
      ) : null}

      {/* The two ways to get a new recipe, before any list of old ones. */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <ActionTile
          icon="sparkle"
          title="Create a recipe"
          body="From a dish name or a description"
          onPress={() => router.push('/recipe/create')}
        />
        <ActionTile
          icon="basket"
          title="Cook what I have"
          body="From your kitchen list"
          onPress={() => router.push('/recipe/create?mode=from_pantry')}
        />
      </View>

      {loading && recipes.length === 0 ? (
        <View style={{ gap: theme.spacing.base }}>
          <Skeleton height={200} radius={theme.radius.surface} />
          <Skeleton height={76} radius={theme.radius.surface} />
        </View>
      ) : null}

      {cookable.length > 0 ? (
        <Section
          title="Closest to cookable"
          subtitle="Ranked against your kitchen list"
          dense
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.md, paddingRight: theme.gutter }}
          >
            {cookable.map(({ recipe, missingCount, total }) => (
              <PressableScale
                key={recipe.id}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${recipe.title}, missing ${missingCount} of ${total} ingredients`}
                scaleTo={0.985}
                style={{ width: 232, gap: theme.spacing.sm }}
              >
                <RecipeImage
                  image={recipe.image}
                  recipeId={recipe.id}
                  title={recipe.title}
                  height={136}
                  style={{ borderRadius: theme.radius.media }}
                />
                <Text variant="headline" numberOfLines={2}>
                  {recipe.title}
                </Text>
                <Text
                  variant="footnote"
                  color={missingCount === 0 ? 'primary' : 'textMuted'}
                >
                  {missingCount === 0
                    ? 'You have everything'
                    : `Missing ${missingCount} of ${total}`}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        </Section>
      ) : null}

      <Section
        title="Browse by cuisine"
        subtitle="Opens the creator, set to that style"
        dense
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {CUISINE_OPTIONS.slice(0, CUISINE_CHIPS).map((cuisine) => (
            <PressableScale
              key={cuisine.value}
              onPress={() => router.push(`/recipe/create?cuisine=${cuisine.value}`)}
              accessibilityRole="button"
              accessibilityLabel={`Create a ${cuisine.label} recipe`}
              style={{
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.base,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.surfaceAlt,
              }}
            >
              <Text variant="footnote" style={{ fontWeight: '600' }}>
                {cuisine.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      </Section>

      {favourites.length > 0 ? (
        <Section title="Your favourites" dense>
          <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.base }}>
            {favourites.map((recipe) => (
              <RecipeLine
                key={recipe.id}
                recipe={recipe}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              />
            ))}
          </Surface>
        </Section>
      ) : null}

      <Section
        title="Your recipes"
        dense
        action={
          recipes.length > 0
            ? { label: 'All', onPress: () => router.push('/recipe/saved') }
            : undefined
        }
      >
        {recipes.length === 0 && !loading ? (
          /*
            Nothing invented to fill the gap. A new account genuinely has no
            recipes, and a page of borrowed ones would be the app pretending
            to know something about this person.
          */
          <EmptyState
            title="No recipes yet"
            body="Create one from a dish you like, or from what is in your kitchen right now."
            illustration={<Icon name="recipes" size={38} color="primary" strokeWidth={1.5} />}
            actionLabel="Create a recipe"
            onAction={() => router.push('/recipe/create')}
          />
        ) : (
          <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.base }}>
            {recipes.slice(0, 8).map((recipe) => (
              <RecipeLine
                key={recipe.id}
                recipe={recipe}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              />
            ))}
          </Surface>
        )}
      </Section>

      {/*
        The kitchen list is what makes the first section work, so it is
        offered here rather than only in Profile.
      */}
      {pantryItems.length === 0 ? (
        <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color="textMuted">
            WHAT IS IN YOUR KITCHEN
          </Text>
          <Text variant="caption" color="textMuted">
            Tell FoodLens what you keep at home and your recipes get sorted by
            how close they are to cookable tonight.
          </Text>
          <Button
            label="Set up my kitchen"
            variant="tonal"
            onPress={() => router.push('/settings/kitchen')}
            fullWidth
          />
        </Surface>
      ) : null}
    </Screen>
  );
}

function ActionTile({
  icon,
  title,
  body,
  onPress,
}: {
  icon: 'sparkle' | 'basket';
  title: string;
  body: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{ flex: 1 }}
    >
      <Surface variant="raised" padding="base" style={{ gap: theme.spacing.sm }}>
        <Icon name={icon} size={22} color="primary" strokeWidth={1.8} />
        <Text variant="headline">{title}</Text>
        <Text variant="caption" color="textMuted">
          {body}
        </Text>
      </Surface>
    </PressableScale>
  );
}

function RecipeLine({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  const theme = useTheme();
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  const facts = [
    recipe.origin === 'demo_sample' ? 'Demo' : null,
    cuisineLabel(recipe.cuisine),
    totalMinutes > 0 ? `${totalMinutes} min` : null,
    `serves ${recipe.servings}`,
  ].filter(Boolean);

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      accessibilityHint="Opens the recipe"
      scaleTo={0.985}
    >
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
        <RecipeImage
          image={recipe.image}
          recipeId={recipe.id}
          title={recipe.title}
          height={60}
          style={{ width: 60, borderRadius: theme.radius.media }}
        />

        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="headline" numberOfLines={2}>
            {recipe.title}
          </Text>
          <Text variant="footnote" color="textSubtle">
            {facts.join('  ·  ')}
          </Text>
        </View>

        <Icon name="chevronRight" size={16} color="textSubtle" />
      </View>
    </PressableScale>
  );
}
