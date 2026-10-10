import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import {
  Disclosure,
  EmptyState,
  ErrorState,
  PressableScale,
  Row,
  Screen,
  Section,
  Skeleton,
  Surface,
  Text,
} from '@/components/ui';
import { getGenerationAvailability, useRecipes, useShoppingLists } from '@/features/recipes';
import { cuisineLabel } from '@/features/recipes/options';
import { useTheme } from '@/theme';
import type { Recipe } from '@/types/recipe';

/**
 * The Recipes hub.
 *
 * One prominent way in, the rest as a grouped list. Earlier this was four
 * equally-weighted outlined panels, which gave the eye nowhere to land and
 * made every option look like the same kind of thing.
 */
export default function RecipesScreen() {
  const theme = useTheme();
  const router = useRouter();

  const saved = useRecipes({ limit: 20 });
  const recentlyCooked = useRecipes({ orderBy: 'cooked', limit: 4 });
  const lists = useShoppingLists('active');

  const availability = getGenerationAvailability();

  return (
    <Screen
      title="Recipes"
      edges={{ top: true }}
      refreshing={saved.loading}
      onRefresh={() => {
        saved.reload();
        recentlyCooked.reload();
        lists.reload();
      }}
    >
      {/* The one thing this screen is for. */}
      <PressableScale
        onPress={() => router.push('/recipe/create')}
        haptic
        accessibilityRole="button"
        accessibilityLabel="Create a recipe"
        accessibilityHint="Name a dish, describe one, or use a photo"
      >
        <Surface
          variant="raised"
          padding="lg"
          style={{ gap: theme.spacing.md, backgroundColor: theme.colors.primary }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Icon name="sparkle" size={20} color={theme.colors.textOnPrimary} />
            <Text variant="title2" color="textOnPrimary">
              Create a recipe
            </Text>
          </View>
          <Text variant="callout" color={theme.colors.primarySoft}>
            Name a dish, describe one in your own words, or show a photo.
          </Text>
        </Surface>
      </PressableScale>

      <Surface variant="grouped">
        <Row
          title="Cook with what I have"
          subtitle="List your ingredients, get something for tonight"
          leading={<Icon name="basket" size={19} color="textMuted" />}
          trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
          onPress={() =>
            router.push({ pathname: '/recipe/create', params: { mode: 'from_pantry' } })
          }
        />
        <Row
          title="My recipes"
          subtitle={
            saved.recipes.length > 0
              ? `${saved.recipes.length} saved`
              : 'Nothing saved yet'
          }
          leading={<Icon name="recipes" size={19} color="textMuted" />}
          trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
          divided
          onPress={() => router.push('/recipe/saved')}
        />
        <Row
          title="Shopping lists"
          subtitle={
            lists.lists.length > 0
              ? `${lists.lists.length} active`
              : 'Build one from a recipe you are cooking'
          }
          leading={<Icon name="basket" size={19} color="textMuted" />}
          trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
          divided
          onPress={() => router.push('/shopping')}
        />
      </Surface>

      {recentlyCooked.recipes.length > 0 ? (
        <Section title="Cook it again" subtitle="Dishes you have made before">
          <View style={{ gap: theme.spacing.md }}>
            {recentlyCooked.recipes.map((recipe) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section
        title="Saved"
        action={
          saved.recipes.length > 5
            ? { label: 'See all', onPress: () => router.push('/recipe/saved') }
            : undefined
        }
      >
        {saved.error ? (
          <ErrorState
            message={saved.error.message}
            detail={saved.error.detail}
            onRetry={saved.error.retryable ? saved.reload : undefined}
          />
        ) : saved.loading && saved.recipes.length === 0 ? (
          <View style={{ gap: theme.spacing.md }}>
            <Skeleton height={72} radius={theme.radius.media} />
            <Skeleton height={72} radius={theme.radius.media} />
          </View>
        ) : saved.recipes.length === 0 ? (
          <EmptyState
            title="No saved recipes"
            body="Create one and it is saved automatically, so you can come back and cook it again."
            illustration={<Icon name="recipes" size={38} color="primary" strokeWidth={1.5} />}
            actionLabel="Create your first recipe"
            onAction={() => router.push('/recipe/create')}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {saved.recipes.slice(0, 5).map((recipe) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              />
            ))}
          </View>
        )}
      </Section>

      {!availability.available ? (
        <Disclosure
          summary="Recipe writing is not set up in this build"
          detail={`${availability.reason} You can still write recipes by hand, use your saved ones, and open a bundled demo recipe to see how the feature works.`}
          tone="caution"
        />
      ) : null}
    </Screen>
  );
}

/**
 * One recipe in a list.
 *
 * A thumbnail, a name, and the facts as one line of text. The facts used to
 * be a row of four coloured pills per recipe, which turned any list into a
 * wall of chips.
 */
export function RecipeRow({
  recipe,
  onPress,
}: {
  recipe: Recipe;
  onPress: () => void;
}) {
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
          title={recipe.title}
          height={66}
          style={{ width: 66, borderRadius: theme.radius.media }}
        />

        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="headline" numberOfLines={2}>
            {recipe.title}
          </Text>
          <Text variant="footnote" color="textSubtle">
            {facts.join('  ·  ')}
          </Text>
        </View>

        {recipe.isFavorite ? (
          <Icon name="star" size={16} color="accent" filled />
        ) : null}
        <Icon name="chevronRight" size={16} color="textSubtle" />
      </View>
    </PressableScale>
  );
}
