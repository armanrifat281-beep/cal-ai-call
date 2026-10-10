import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
  TextField,
} from '@/components/ui';
import { useRecipeSearch, useRecipes } from '@/features/recipes';
import { useTheme } from '@/theme';

import { RecipeRow } from '../(tabs)/recipes';

type Filter = 'all' | 'favorites' | 'rejected';

const FILTERS = [
  { value: 'all' as const, label: 'All' },
  { value: 'favorites' as const, label: 'Favourites' },
  { value: 'rejected' as const, label: 'Hidden' },
];

/**
 * All saved recipes, with search.
 *
 * The "Hidden" filter is how a user gets back to something they told FoodLens
 * to stop suggesting. Rejecting a recipe hides it from suggestions; it does
 * not delete it, and this screen is where that promise is kept.
 */
export default function SavedRecipesScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const browsing = useRecipes({
    favoritesOnly: filter === 'favorites',
    includeRejected: filter === 'rejected',
  });
  const searching = useRecipeSearch(query);

  const isSearching = query.trim().length > 0;

  // The rejected filter needs the hidden ones only, not everything.
  const browsed =
    filter === 'rejected'
      ? browsing.recipes.filter((recipe) => recipe.rejectedAt !== null)
      : browsing.recipes;

  const shown = isSearching ? searching.results : browsed;
  const loading = isSearching ? searching.loading : browsing.loading;
  const error = isSearching ? searching.error : browsing.error;

  return (
    <Screen
      refreshing={browsing.loading}
      onRefresh={browsing.reload}
      contentStyle={{ gap: theme.spacing.base }}
    >
      <TextField
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="Dish name or an ingredient"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {!isSearching ? (
        <SegmentedControl
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          accessibilityLabel="Filter recipes"
        />
      ) : null}

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? browsing.reload : undefined}
        />
      ) : loading && shown.length === 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Skeleton height={84} radius={theme.radius.surface} />
          <Skeleton height={84} radius={theme.radius.surface} />
          <Skeleton height={84} radius={theme.radius.surface} />
        </View>
      ) : shown.length === 0 ? (
        <Card variant="soft" padding="none">
          <EmptyState
            title={
              isSearching
                ? `Nothing matches "${query.trim()}"`
                : filter === 'favorites'
                  ? 'No favourites yet'
                  : filter === 'rejected'
                    ? 'Nothing hidden'
                    : 'No saved recipes'
            }
            body={
              isSearching
                ? 'Try a shorter search, or an ingredient instead of a dish name.'
                : filter === 'favorites'
                  ? 'Open a recipe and save it to favourites to find it here.'
                  : filter === 'rejected'
                    ? 'Recipes you tell FoodLens to stop suggesting show up here, so you can always get them back.'
                    : 'Create a recipe and it is saved automatically.'
            }
            illustration={<Icon name="recipes" size={44} color="primary" />}
            actionLabel={isSearching || filter !== 'all' ? undefined : 'Create a recipe'}
            onAction={
              isSearching || filter !== 'all'
                ? undefined
                : () => router.push('/recipe/create')
            }
          />
        </Card>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {isSearching ? (
            <Text variant="callout" color="textMuted">
              {shown.length} match{shown.length === 1 ? '' : 'es'}
            </Text>
          ) : null}
          {shown.map((recipe) => (
            <RecipeRow
              key={recipe.id}
              recipe={recipe}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
