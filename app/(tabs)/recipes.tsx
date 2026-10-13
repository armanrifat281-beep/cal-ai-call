import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import {
  Chip,
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
  TextField,
} from '@/components/ui';
import {
  getGenerationAvailability,
  matchPantry,
  useRecipes,
  useShoppingLists,
} from '@/features/recipes';
import { cuisineLabel } from '@/features/recipes/options';
import { usePreferencesStore } from '@/store/preferencesStore';
import { ramps, useTheme } from '@/theme';
import type { CuisineId, Recipe } from '@/types/recipe';

/** A recipe anyone can get on the table on a weeknight. */
const QUICK_MINUTES = 30;

/** Enough to browse; the rest are a tap away under "All". */
const SECTION_LIMIT = 6;

type Filter =
  | { kind: 'all' }
  | { kind: 'favourites' }
  | { kind: 'quick' }
  | { kind: 'cuisine'; id: CuisineId };

function totalMinutes(recipe: Recipe): number {
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
}

/**
 * The Recipes library.
 *
 * Everything here is counted from the user's own saved recipes and their
 * kitchen list. There is no recipe service behind this app, so nothing is
 * fetched, trending or editorial - a row of invented suggestions would be
 * decoration pretending to be data.
 *
 * Sections appear only when they have something in them. That is the whole
 * answer to the screen looking half-finished: a page of headings over empty
 * space reads as broken, where four full sections and no empty ones reads as
 * a library that happens to be this size.
 */
export default function RecipesScreen() {
  const theme = useTheme();
  const router = useRouter();

  const saved = useRecipes({ limit: 100 });
  const recentlyCooked = useRecipes({ orderBy: 'cooked', limit: 4 });
  const lists = useShoppingLists('active');
  const pantryItems = usePreferencesStore((state) => state.preferences.pantryItems);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });

  const availability = getGenerationAvailability();
  const recipes = saved.recipes;

  /**
   * The cuisines this user actually has.
   *
   * Taken from their recipes rather than from the full list of twenty the
   * creator offers: a filter that returns nothing is worse than no filter,
   * and a row of chips for food they have never saved is a menu of dead
   * ends.
   */
  const cuisines = useMemo<CuisineId[]>(() => {
    const seen = new Map<CuisineId, number>();
    for (const recipe of recipes) {
      if (recipe.cuisine === null) continue;
      seen.set(recipe.cuisine, (seen.get(recipe.cuisine) ?? 0) + 1);
    }
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .slice(0, 6);
  }, [recipes]);

  const hasQuick = useMemo(
    () => recipes.some((recipe) => {
      const minutes = totalMinutes(recipe);
      return minutes > 0 && minutes <= QUICK_MINUTES;
    }),
    [recipes],
  );

  const hasFavourites = useMemo(
    () => recipes.some((recipe) => recipe.isFavorite),
    [recipes],
  );

  /** Search and the chips, applied together, over the real list. */
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return recipes.filter((recipe) => {
      if (needle.length > 0) {
        const haystack = [
          recipe.title,
          recipe.description ?? '',
          ...recipe.ingredients.map((item) => item.name),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      switch (filter.kind) {
        case 'favourites':
          return recipe.isFavorite;
        case 'quick': {
          const minutes = totalMinutes(recipe);
          return minutes > 0 && minutes <= QUICK_MINUTES;
        }
        case 'cuisine':
          return recipe.cuisine === filter.id;
        default:
          return true;
      }
    });
  }, [recipes, query, filter]);

  /** True while the user is narrowing: the sections give way to one list. */
  const narrowing = query.trim().length > 0 || filter.kind !== 'all';

  /** What the kitchen list already covers. Needs a kitchen list to mean anything. */
  const readyToCook = useMemo(() => {
    if (pantryItems.length === 0) return [];
    return recipes
      .map((recipe) => ({
        recipe,
        missing: matchPantry(recipe.ingredients, pantryItems).missing.length,
        total: recipe.ingredients.length,
      }))
      .filter((entry) => entry.total > 0 && entry.missing < entry.total)
      .sort((a, b) => a.missing - b.missing)
      .slice(0, SECTION_LIMIT);
  }, [recipes, pantryItems]);

  /*
    The big card only once there is a library to pick it out of.

    With one or two recipes it repeated what the sections below already
    showed, so the same dish appeared three times and the page read as
    padding rather than as a shelf.
  */
  const featured = recipes.length >= 3 ? recipes[0] : undefined;
  const quick = recipes
    .filter((recipe) => {
      const minutes = totalMinutes(recipe);
      return minutes > 0 && minutes <= QUICK_MINUTES;
    })
    .slice(0, SECTION_LIMIT);
  const favourites = recipes.filter((recipe) => recipe.isFavorite).slice(0, SECTION_LIMIT);

  const open = (id: string) => router.push(`/recipe/${id}`);

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
      contentStyle={{ gap: theme.spacing.lg }}
    >
      {/*
        A question rather than a verb. "Create a recipe" is what the button
        does; "What shall we cook?" is what the user came here to answer.
      */}
      <PressableScale
        onPress={() => router.push('/recipe/create')}
        haptic
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityLabel="What shall we cook?"
        accessibilityHint="Name a dish, describe one, or use a photo"
      >
        {/*
          The photograph, not the brand gradient.

          This card is the one place on the screen that is about wanting
          something rather than recording it, and a plate of food says that
          better than a colour does. The scrim under it is what keeps the
          white type readable - the image is bright in its lower half, and
          the text sits there.
        */}
        <View
          style={{
            borderRadius: theme.radius.surface + 6,
            overflow: 'hidden',
          }}
        >
          <Image
            source={require('../../assets/welcome-meal.jpg')}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            /*
              A band about two thirds down the frame, which is where the
              dish is. A short, wide crop of a tall photograph shows the
              plate rim at centre and the dark table at the bottom; neither
              reads as food.
            */
            contentPosition={{ top: '64%', left: '50%' }}
            cachePolicy="memory-disk"
            transition={200}
            accessibilityLabel=""
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.78)', 'rgba(0,0,0,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            pointerEvents="none"
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.base,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.xl,
            }}
          >
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text variant="headline" color={ramps.neutral[25]}>
                What shall we cook?
              </Text>
              <Text variant="footnote" color="rgba(247,247,248,0.82)">
                Name a dish, or say what you have in.
              </Text>
            </View>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: ramps.neutral[25],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="sparkle" size={20} color={ramps.neutral[900]} />
            </View>
          </View>
        </View>
      </PressableScale>

      {/*
        Given its own card rather than a list row. It is the feature that
        answers "what can I eat right now", which is a different question
        from "write me a recipe", and it was previously the same weight as
        the shopping-list link.
      */}
      <PressableScale
        onPress={() =>
          router.push({ pathname: '/recipe/create', params: { mode: 'from_pantry' } })
        }
        haptic
        accessibilityRole="button"
        accessibilityLabel="Cook with your ingredients"
      >
        <Surface variant="raised" padding="base">
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.base }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.control,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Icon name="basket" size={21} color="primaryOnSoft" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline">Cook with your ingredients</Text>
              <Text variant="caption" color="textMuted">
                {pantryItems.length > 0
                  ? `${pantryItems.length} ingredient${pantryItems.length === 1 ? '' : 's'} in your kitchen`
                  : 'Tell FoodLens what you have at home'}
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color="textSubtle" />
          </View>
        </Surface>
      </PressableScale>

      {saved.error ? (
        <ErrorState
          message={saved.error.message}
          detail={saved.error.detail}
          onRetry={saved.error.retryable ? saved.reload : undefined}
        />
      ) : null}

      {saved.loading && recipes.length === 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <Skeleton height={180} radius={theme.radius.surface} />
          <Skeleton height={72} radius={theme.radius.media} />
          <Skeleton height={72} radius={theme.radius.media} />
        </View>
      ) : null}

      {recipes.length === 0 && !saved.loading && !saved.error ? (
        <EmptyState
          title="No recipes yet"
          body="Write one from a dish you like, or from what is in your kitchen right now. Everything you create is saved here."
          illustration={<Icon name="recipes" size={38} color="primary" strokeWidth={1.5} />}
          actionLabel="Create your first recipe"
          onAction={() => router.push('/recipe/create')}
        />
      ) : null}

      {recipes.length > 0 ? (
        <>
          <TextField
            label="Search your recipes"
            value={query}
            onChangeText={setQuery}
            placeholder="A dish, or an ingredient"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />

          {/*
            Chips for what this library actually contains. "Quick" and
            "Favourites" appear only when some recipe qualifies, so no chip
            can return an empty list.
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.gutter }}
          >
            <Chip
              label="All"
              selected={filter.kind === 'all'}
              onPress={() => setFilter({ kind: 'all' })}
            />
            {hasFavourites ? (
              <Chip
                label="Favourites"
                selected={filter.kind === 'favourites'}
                onPress={() => setFilter({ kind: 'favourites' })}
              />
            ) : null}
            {hasQuick ? (
              <Chip
                label={`Under ${QUICK_MINUTES} min`}
                selected={filter.kind === 'quick'}
                onPress={() => setFilter({ kind: 'quick' })}
              />
            ) : null}
            {cuisines.map((id) => (
              <Chip
                key={id}
                label={cuisineLabel(id) ?? 'Other'}
                selected={filter.kind === 'cuisine' && filter.id === id}
                onPress={() => setFilter({ kind: 'cuisine', id })}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* Narrowing replaces the sections: one list, so the result of the
          search is never buried under headings that ignore it. */}
      {narrowing ? (
        <Section
          title={`${matching.length} recipe${matching.length === 1 ? '' : 's'}`}
          dense
          action={
            filter.kind !== 'all' || query.length > 0
              ? {
                  label: 'Clear',
                  onPress: () => {
                    setQuery('');
                    setFilter({ kind: 'all' });
                  },
                }
              : undefined
          }
        >
          {matching.length === 0 ? (
            <EmptyState
              title="Nothing matches"
              body="Try a different word, or clear the filters to see everything you have saved."
              illustration={<Icon name="search" size={34} color="textMuted" strokeWidth={1.5} />}
            />
          ) : (
            <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.base }}>
              {matching.map((recipe) => (
                <RecipeRow key={recipe.id} recipe={recipe} onPress={() => open(recipe.id)} />
              ))}
            </Surface>
          )}
        </Section>
      ) : (
        <>
          {featured ? (
            <Section title="Latest" subtitle="The last recipe you made or saved" dense>
              <PressableScale
                onPress={() => open(featured.id)}
                scaleTo={0.99}
                accessibilityRole="button"
                accessibilityLabel={featured.title}
                style={{ gap: theme.spacing.sm }}
              >
                <RecipeImage
                  image={featured.image}
                  recipeId={featured.id}
                  title={featured.title}
                  height={176}
                  style={{ borderRadius: theme.radius.media }}
                />
                <Text variant="title2" numberOfLines={2}>
                  {featured.title}
                </Text>
                <Text variant="footnote" color="textSubtle">
                  {factsFor(featured).join('  ·  ')}
                </Text>
              </PressableScale>
            </Section>
          ) : null}

          {readyToCook.length > 0 ? (
            <Section
              title="Closest to cookable"
              subtitle="Against the ingredients in your kitchen"
              dense
            >
              <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.base }}>
                {readyToCook.map(({ recipe, missing, total }) => (
                  <RecipeRow
                    key={recipe.id}
                    recipe={recipe}
                    onPress={() => open(recipe.id)}
                    note={
                      missing === 0
                        ? 'You have everything'
                        : `Missing ${missing} of ${total}`
                    }
                  />
                ))}
              </Surface>
            </Section>
          ) : null}

          {quick.length > 0 ? (
            <Section
              title="Quick and easy"
              subtitle={`On the table in ${QUICK_MINUTES} minutes or less`}
              dense
            >
              <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.base }}>
                {quick.map((recipe) => (
                  <RecipeRow key={recipe.id} recipe={recipe} onPress={() => open(recipe.id)} />
                ))}
              </Surface>
            </Section>
          ) : null}

          {favourites.length > 0 ? (
            <Section title="Favourites" dense>
              <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.base }}>
                {favourites.map((recipe) => (
                  <RecipeRow key={recipe.id} recipe={recipe} onPress={() => open(recipe.id)} />
                ))}
              </Surface>
            </Section>
          ) : null}

          {recentlyCooked.recipes.length > 0 ? (
            <Section title="Cook it again" subtitle="Dishes you have made before" dense>
              <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.base }}>
                {recentlyCooked.recipes.map((recipe) => (
                  <RecipeRow key={recipe.id} recipe={recipe} onPress={() => open(recipe.id)} />
                ))}
              </Surface>
            </Section>
          ) : null}

          {/*
            Always drawn when anything is saved. It was `> 1`, to avoid
            repeating a lone recipe that the card above was already showing -
            but the card needs three recipes before it appears, so a library
            of one rendered nowhere at all.
          */}
          {recipes.length > 0 ? (
            <Section
              title="All recipes"
              dense
              action={
                recipes.length > SECTION_LIMIT
                  ? { label: 'See all', onPress: () => router.push('/recipe/saved') }
                  : undefined
              }
            >
              <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.base }}>
                {recipes.slice(0, SECTION_LIMIT).map((recipe) => (
                  <RecipeRow key={recipe.id} recipe={recipe} onPress={() => open(recipe.id)} />
                ))}
              </Surface>
            </Section>
          ) : null}
        </>
      )}

      <Surface variant="grouped">
        <Row
          title="Shopping lists"
          subtitle={
            lists.lists.length > 0
              ? `${lists.lists.length} active`
              : 'Build one from a recipe you are cooking'
          }
          leading={<Icon name="basket" size={19} color="textMuted" />}
          trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
          onPress={() => router.push('/shopping')}
        />
        <Row
          title="My kitchen"
          subtitle={
            pantryItems.length > 0
              ? `${pantryItems.length} ingredient${pantryItems.length === 1 ? '' : 's'} at home`
              : 'Say what you have, and recipes show what you need'
          }
          leading={<Icon name="leaf" size={19} color="textMuted" />}
          trailing={<Icon name="chevronRight" size={16} color="textSubtle" />}
          divided
          onPress={() => router.push('/settings/kitchen')}
        />
      </Surface>

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

/** The facts worth showing, and only the ones this recipe actually has. */
function factsFor(recipe: Recipe): string[] {
  const minutes = totalMinutes(recipe);

  return [
    recipe.origin === 'demo_sample' ? 'Demo' : null,
    cuisineLabel(recipe.cuisine),
    minutes > 0 ? `${minutes} min` : null,
    `serves ${recipe.servings}`,
  ].filter((fact): fact is string => fact !== null);
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
  note,
}: {
  recipe: Recipe;
  onPress: () => void;
  /** A line specific to the section, e.g. what the kitchen is missing. */
  note?: string;
}) {
  const theme = useTheme();

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
          height={66}
          style={{ width: 66, borderRadius: theme.radius.media }}
        />

        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="headline" numberOfLines={2}>
            {recipe.title}
          </Text>
          <Text variant="footnote" color="textSubtle">
            {factsFor(recipe).join('  ·  ')}
          </Text>
          {note === undefined ? null : (
            <Text variant="caption" color="primary">
              {note}
            </Text>
          )}
        </View>

        {recipe.isFavorite ? <Icon name="star" size={16} color="accent" filled /> : null}
        <Icon name="chevronRight" size={16} color="textSubtle" />
      </View>
    </PressableScale>
  );
}
