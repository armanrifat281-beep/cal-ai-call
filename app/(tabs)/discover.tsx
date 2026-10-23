import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import {
  Appear,
  Avatar,
  EmptyState,
  ErrorState,
  PressableScale,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { matchPantry, useRecipes } from '@/features/recipes';
import { CUISINE_OPTIONS } from '@/features/recipes/options';
import { greetingFor } from '@/lib/greeting';
import { useAvatarStore } from '@/features/profile';
import { usePreferencesStore } from '@/store/preferencesStore';
import { SchemeOverride, useTheme } from '@/theme';
import type { Recipe } from '@/types/recipe';

/** Enough to browse, few enough that nothing needs a second screen. */
const PICKS_LIMIT = 8;
/** How many cuisines join the type row. Past this it is a list, not a row. */
const CUISINE_CHIPS = 10;

interface Cookable {
  recipe: Recipe;
  missingCount: number;
  total: number;
}

/**
 * How a type chip is drawn, and what it does.
 *
 * Every one of these opens the recipe creator already set to that style, so
 * a tap produces a real recipe rather than a filtered list of nothing. That
 * is the honest version of a "browse by type" row in an app with no
 * editorial catalogue behind it: the categories are real, and so is what
 * happens when you press one.
 */
const TYPES: { key: string; label: string; icon: IconName; query: string }[] = [
  { key: 'vegan', label: 'Vegan', icon: 'leaf', query: 'diet=vegan' },
  { key: 'protein', label: 'Protein', icon: 'flame', query: 'focus=high_protein' },
  { key: 'quick', label: 'Quick', icon: 'timer', query: 'maxMinutes=20' },
  { key: 'pantry', label: 'In my kitchen', icon: 'basket', query: 'mode=from_pantry' },
];

/**
 * Discover, and the recipe it opens, are the app's pale half.
 *
 * Every other screen is a black page with a lime accent. These two are mint
 * and green, and that is not an inconsistency - it is the one place the
 * product is about food somebody has not eaten yet rather than food they
 * have. Photographs of dishes need light around them, a browse is a
 * different act from a reckoning, and the dark screens stay dark precisely
 * because this is the only exception.
 *
 * `SchemeOverride` is what makes it one product rather than two: these
 * screens are built from exactly the same components, type scale, spacing
 * and icons as the dark ones, in the light palette that goes with them. No
 * literal colours are written here.
 */
export default function DiscoverScreen() {
  return (
    <SchemeOverride scheme="light">
      {/*
        The root sets the bar from the user's own scheme, which is dark. On
        a mint page that paints the clock and the battery in white on white.
      */}
      <StatusBar style="dark" />
      <Discover />
    </SchemeOverride>
  );
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
 * is to cookable right now, which is the question somebody opens a recipe
 * screen to ask at six in the evening - and, when they have nothing saved
 * yet, hand them straight to the thing that makes one.
 */
function Discover() {
  const theme = useTheme();
  const router = useRouter();

  const { recipes, loading, error, reload } = useRecipes({ limit: 60 });
  const pantryItems = usePreferencesStore((state) => state.preferences.pantryItems);
  const displayName = usePreferencesStore((state) => state.preferences.displayName);
  const avatarUri = useAvatarStore((state) => state.uri);

  const [query, setQuery] = useState('');

  /**
   * The user's recipes, nearest-to-cookable first.
   *
   * With a kitchen list this is a genuine ranking. Without one every recipe
   * is equally far away, so it falls back to the most recent - which is at
   * least an order somebody chose, rather than a ranking by nothing.
   */
  const picks = useMemo<Cookable[]>(() => {
    const matched = recipes.map((recipe) => {
      if (pantryItems.length === 0) {
        return { recipe, missingCount: -1, total: recipe.ingredients.length };
      }
      const match = matchPantry(recipe.ingredients, pantryItems);
      return {
        recipe,
        missingCount: match.missing.length,
        total: match.available.length + match.missing.length,
      };
    });

    const filtered =
      query.trim().length === 0
        ? matched
        : matched.filter((entry) =>
            entry.recipe.title.toLowerCase().includes(query.trim().toLowerCase()),
          );

    if (pantryItems.length === 0) return filtered.slice(0, PICKS_LIMIT);

    return filtered
      .sort((a, b) => a.missingCount - b.missingCount)
      .slice(0, PICKS_LIMIT);
  }, [recipes, pantryItems, query]);

  const favourites = useMemo(
    () => recipes.filter((recipe) => recipe.isFavorite).slice(0, 8),
    [recipes],
  );

  const greeting = greetingFor(new Date().getHours(), null).toLowerCase();

  return (
    <Screen
      edges={{ top: true }}
      refreshing={loading}
      onRefresh={reload}
      contentStyle={{ gap: theme.spacing.lg }}
      inset="none"
    >
      <View style={{ paddingHorizontal: theme.gutter, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Avatar
            name={displayName}
            imageUri={avatarUri}
            size={44}
            onPress={() => router.push('/(tabs)/profile')}
          />
          <View style={{ flex: 1, gap: 1 }}>
            <Text variant="headline" numberOfLines={1}>
              {displayName ? `Hi ${displayName}` : 'Hello'}
            </Text>
            <Text variant="caption" color="textSubtle">
              Good {greeting}
            </Text>
          </View>
        </View>

        <Text variant="display" style={{ fontSize: 31, lineHeight: 37 }}>
          What are you craving{' '}
          <Text variant="display" color="primary" style={{ fontSize: 31, lineHeight: 37 }}>
            today?
          </Text>
        </Text>

        {/*
          A filter on what the user has saved, not a search of a catalogue.

          There is no recipe service to query, so a box that implied one
          would come back empty and look broken. The placeholder says which
          it is, and the button beside it goes where a search of everything
          would actually have to go: the creator, which can make the thing
          that does not exist yet.
        */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              paddingHorizontal: theme.spacing.base,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Icon name="search" size={17} color="textSubtle" strokeWidth={1.8} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your recipes…"
              placeholderTextColor={theme.colors.textSubtle}
              accessibilityLabel="Search your saved recipes"
              returnKeyType="search"
              style={{
                flex: 1,
                paddingVertical: 14,
                fontSize: 15,
                color: theme.colors.text,
              }}
            />
          </View>

          <PressableScale
            onPress={() => router.push('/recipe/create')}
            haptic
            accessibilityRole="button"
            accessibilityLabel="Create a new recipe"
            scaleTo={0.92}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primary,
            }}
          >
            <Icon
              name="sparkle"
              size={20}
              color={theme.colors.textOnPrimary}
              strokeWidth={1.8}
            />
          </PressableScale>
        </View>

        {error ? (
          <ErrorState
            message={error.message}
            detail={error.detail}
            onRetry={error.retryable ? reload : undefined}
          />
        ) : null}
      </View>

      <Appear index={0}>
        <View style={{ gap: theme.spacing.md }}>
          <SectionHeading
            title="Browse by type"
            action={{ label: 'All styles', onPress: () => router.push('/recipe/create') }}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: theme.spacing.sm,
              paddingHorizontal: theme.gutter,
            }}
          >
            {TYPES.map((type) => (
              <PressableScale
                key={type.key}
                onPress={() => router.push(`/recipe/create?${type.query}`)}
                haptic
                accessibilityRole="button"
                accessibilityLabel={`Create a ${type.label.toLowerCase()} recipe`}
                style={{
                  width: 84,
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  paddingVertical: theme.spacing.base,
                  borderRadius: 18,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.primarySoft,
                  }}
                >
                  <Icon name={type.icon} size={18} color="primary" strokeWidth={1.8} />
                </View>
                <Text variant="caption" numberOfLines={1} style={{ fontWeight: '600' }}>
                  {type.label}
                </Text>
              </PressableScale>
            ))}

            {CUISINE_OPTIONS.slice(0, CUISINE_CHIPS).map((cuisine) => (
              <PressableScale
                key={cuisine.value}
                onPress={() => router.push(`/recipe/create?cuisine=${cuisine.value}`)}
                accessibilityRole="button"
                accessibilityLabel={`Create a ${cuisine.label} recipe`}
                style={{
                  width: 84,
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  paddingVertical: theme.spacing.base,
                  borderRadius: 18,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.surfaceAlt,
                  }}
                >
                  <Icon name="recipes" size={18} color="textMuted" strokeWidth={1.8} />
                </View>
                <Text variant="caption" numberOfLines={1} style={{ fontWeight: '600' }}>
                  {cuisine.label}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      </Appear>

      <Appear index={1}>
        <View style={{ gap: theme.spacing.md }}>
          <SectionHeading
            title={pantryItems.length > 0 ? 'Closest to cookable' : 'Your recipes'}
            subtitle={
              pantryItems.length > 0
                ? 'Ranked against your kitchen list'
                : 'Add a kitchen list to have these ranked by what you have'
            }
            action={
              recipes.length > 0
                ? { label: 'See all', onPress: () => router.push('/(tabs)/recipes') }
                : undefined
            }
          />

          {loading && recipes.length === 0 ? (
            <View style={{ paddingHorizontal: theme.gutter }}>
              <Skeleton height={190} radius={20} />
            </View>
          ) : picks.length === 0 ? (
            <View style={{ paddingHorizontal: theme.gutter }}>
              <EmptyState
                title={query.trim() ? 'Nothing matched' : 'No recipes yet'}
                body={
                  query.trim()
                    ? 'Nothing you have saved matches that. The button beside the search box will write one.'
                    : 'Describe a dish, or say what is in your kitchen, and the creator will write a recipe you can cook and log.'
                }
                illustration={<Icon name="recipes" size={34} color="primary" strokeWidth={1.5} />}
                actionLabel="Create a recipe"
                onAction={() => router.push('/recipe/create')}
              />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: theme.spacing.md,
                paddingHorizontal: theme.gutter,
              }}
            >
              {picks.map((pick) => (
                <PickCard
                  key={pick.recipe.id}
                  pick={pick}
                  onPress={() => router.push(`/recipe/${pick.recipe.id}`)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </Appear>

      {favourites.length > 0 ? (
        <Appear index={2}>
          <View style={{ gap: theme.spacing.md }}>
            <SectionHeading title="Your favourites" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: theme.spacing.md,
                paddingHorizontal: theme.gutter,
              }}
            >
              {favourites.map((recipe) => (
                <PickCard
                  key={recipe.id}
                  pick={{ recipe, missingCount: -1, total: recipe.ingredients.length }}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        </Appear>
      ) : null}
    </Screen>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.gutter,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title2">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="textSubtle">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action ? (
        <Text
          variant="footnote"
          color="primary"
          style={{ fontWeight: '700' }}
          onPress={action.onPress}
          accessibilityRole="button"
        >
          {action.label}
        </Text>
      ) : null}
    </View>
  );
}

function PickCard({ pick, onPress }: { pick: Cookable; onPress: () => void }) {
  const theme = useTheme();
  const { recipe, missingCount, total } = pick;

  const minutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const kcal = recipe.nutritionPerServing?.caloriesKcal ?? null;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        missingCount < 0
          ? recipe.title
          : `${recipe.title}, missing ${missingCount} of ${total} ingredients`
      }
      scaleTo={0.985}
      style={{
        width: 212,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
        overflow: 'hidden',
      }}
    >
      <View>
        <RecipeImage
          image={recipe.image}
          recipeId={recipe.id}
          title={recipe.title}
          height={126}
        />

        {/*
          The badge says the one thing the card is ranked on. Without a
          kitchen list there is nothing to rank by, so there is no badge -
          rather than a label that sounds like a recommendation nobody made.
        */}
        {missingCount >= 0 ? (
          <View
            style={{
              position: 'absolute',
              left: 10,
              bottom: 10,
              paddingVertical: 5,
              paddingHorizontal: 10,
              borderRadius: theme.radius.pill,
              backgroundColor:
                missingCount === 0 ? theme.colors.primary : 'rgba(0,0,0,0.65)',
            }}
          >
            <Text
              variant="caption"
              color={missingCount === 0 ? theme.colors.textOnPrimary : '#FFFFFF'}
              style={{ fontWeight: '700', fontSize: 11 }}
            >
              {missingCount === 0 ? 'You have it all' : `${missingCount} to buy`}
            </Text>
          </View>
        ) : null}

        {recipe.isFavorite ? (
          <View
            style={{
              position: 'absolute',
              right: 10,
              top: 10,
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          >
            <Icon name="star" size={14} color={theme.colors.primary} filled />
          </View>
        ) : null}
      </View>

      <View style={{ padding: theme.spacing.md, gap: 4 }}>
        <Text variant="headline" numberOfLines={2} style={{ fontSize: 15 }}>
          {recipe.title}
        </Text>
        <Text variant="caption" color="textSubtle">
          {[
            kcal === null ? null : `${Math.round(kcal)} kcal`,
            minutes > 0 ? `${minutes} min` : null,
          ]
            .filter(Boolean)
            .join(' · ') || `${recipe.ingredients.length} ingredients`}
        </Text>
      </View>
    </PressableScale>
  );
}
