import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import {
  EmptyState,
  ErrorState,
  SegmentedControl,
  Skeleton,
  Text,
  TextField,
} from '@/components/ui';
import { useRecipeSearch, useRecipes } from '@/features/recipes';
import type { Recipe } from '@/types/recipe';
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
 * The "Hidden" filter is how a user gets back to something they told
 * FoodLens to stop suggesting. Rejecting hides a recipe from suggestions; it
 * does not delete it, and this screen is where that promise is kept.
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

  const browsed =
    filter === 'rejected'
      ? browsing.recipes.filter((recipe) => recipe.rejectedAt !== null)
      : browsing.recipes;

  const shown = isSearching ? searching.results : browsed;
  const loading = isSearching ? searching.loading : browsing.loading;
  const error = isSearching ? searching.error : browsing.error;

  const insets = useSafeAreaInsets();

  const renderItem = useCallback(
    ({ item }: { item: Recipe }) => (
      <RecipeRow recipe={item} onPress={() => router.push(`/recipe/${item.id}`)} />
    ),
    [router],
  );

  const header = (
    <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
      <Text variant="display">My recipes</Text>

      <TextField
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="A dish name or an ingredient"
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
      ) : null}

      {isSearching && shown.length > 0 ? (
        <Text variant="footnote" color="textMuted">
          {shown.length} match{shown.length === 1 ? '' : 'es'}
        </Text>
      ) : null}
    </View>
  );

  const empty =
    loading && shown.length === 0 ? (
      <View style={{ gap: theme.spacing.md }}>
        <Skeleton height={72} radius={theme.radius.media} />
        <Skeleton height={72} radius={theme.radius.media} />
        <Skeleton height={72} radius={theme.radius.media} />
      </View>
    ) : (
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
              ? 'Open a recipe and star it to find it here.'
              : filter === 'rejected'
                ? 'Recipes you tell FoodLens to stop suggesting show up here, so you can always get them back.'
                : 'Create a recipe and it is saved automatically.'
        }
        illustration={<Icon name="recipes" size={38} color="primary" strokeWidth={1.5} />}
        actionLabel={isSearching || filter !== 'all' ? undefined : 'Create your first recipe'}
        onAction={
          isSearching || filter !== 'all' ? undefined : () => router.push('/recipe/create')
        }
      />
    );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        paddingHorizontal: theme.gutter,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.xxl + insets.bottom,
        flexGrow: 1,
      }}
      data={shown}
      keyExtractor={(recipe) => recipe.id}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      // Keeps the search field responsive while a long list scrolls.
      removeClippedSubviews
      initialNumToRender={8}
      windowSize={7}
      refreshControl={
        <RefreshControl
          refreshing={browsing.loading}
          onRefresh={browsing.reload}
          tintColor={theme.colors.primary}
        />
      }
    />
  );
}
