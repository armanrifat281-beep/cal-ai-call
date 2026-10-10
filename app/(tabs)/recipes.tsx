import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  InfoNote,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { cuisineLabel } from '@/features/recipes/options';
import { useRecipes, useShoppingLists } from '@/features/recipes';
import { getGenerationAvailability } from '@/features/recipes';
import { useTheme } from '@/theme';
import type { Recipe } from '@/types/recipe';
import { Pressable } from 'react-native';

/**
 * The Recipes hub.
 *
 * Four ways in, then what the user already has. Every entry here goes
 * somewhere real: none of these are placeholders.
 */
export default function RecipesScreen() {
  const theme = useTheme();
  const router = useRouter();

  const saved = useRecipes({ limit: 20 });
  const recentlyCooked = useRecipes({ orderBy: 'cooked', limit: 5 });
  const lists = useShoppingLists('active');

  const availability = getGenerationAvailability();

  return (
    <Screen
      edges={{ top: true }}
      refreshing={saved.loading}
      onRefresh={() => {
        saved.reload();
        recentlyCooked.reload();
        lists.reload();
      }}
      contentStyle={{ gap: theme.spacing.lg }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title">Recipes</Text>
        <Text variant="bodySm" color="textMuted">
          Tell FoodLens what you want to cook, or cook from what you already
          have.
        </Text>
      </View>

      {!availability.available ? (
        <InfoNote
          title="Recipe writing is not set up yet"
          body={`${availability.reason} You can still write recipes by hand, use your saved ones, and try a bundled demo recipe to see how the feature works.`}
          tone="warning"
        />
      ) : null}

      <View style={{ gap: theme.spacing.md }}>
        <HubAction
          icon="sparkle"
          title="Create a recipe"
          body="Name a dish, describe one, or show a photo."
          onPress={() => router.push('/recipe/create')}
          primary
        />
        <HubAction
          icon="basket"
          title="Cook with what I have"
          body="List your ingredients and get something you can make tonight."
          onPress={() =>
            router.push({ pathname: '/recipe/create', params: { mode: 'from_pantry' } })
          }
        />
        <HubAction
          icon="journal"
          title="Search my recipes"
          body="Find a dish you saved earlier."
          onPress={() => router.push('/recipe/saved')}
        />
        <HubAction
          icon="basket"
          title="Shopping lists"
          body={
            lists.lists.length > 0
              ? `${lists.lists.length} active list${lists.lists.length === 1 ? '' : 's'}`
              : 'Build a list from a recipe you are cooking.'
          }
          onPress={() => router.push('/shopping')}
        />
      </View>

      {recentlyCooked.recipes.length > 0 ? (
        <Section
          title="Cook it again"
          subtitle="Dishes you have made before."
          onSeeAll={() => router.push('/recipe/saved')}
        >
          {recentlyCooked.recipes.map((recipe) => (
            <RecipeRow
              key={recipe.id}
              recipe={recipe}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
            />
          ))}
        </Section>
      ) : null}

      <Section
        title="Saved recipes"
        subtitle={saved.recipes.length > 0 ? undefined : 'Nothing saved yet.'}
        onSeeAll={saved.recipes.length > 0 ? () => router.push('/recipe/saved') : undefined}
      >
        {saved.error ? (
          <ErrorState
            message={saved.error.message}
            detail={saved.error.detail}
            onRetry={saved.error.retryable ? saved.reload : undefined}
          />
        ) : saved.loading && saved.recipes.length === 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Skeleton height={84} radius={theme.radius.lg} />
            <Skeleton height={84} radius={theme.radius.lg} />
          </View>
        ) : saved.recipes.length === 0 ? (
          <Card variant="soft" padding="none">
            <EmptyState
              title="No saved recipes"
              body="Create one and it is saved automatically, so you can come back to it and cook it again."
              illustration={<Icon name="recipes" size={44} color="primary" />}
              actionLabel="Create your first recipe"
              onAction={() => router.push('/recipe/create')}
            />
          </Card>
        ) : (
          saved.recipes
            .slice(0, 5)
            .map((recipe) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              />
            ))
        )}
      </Section>
    </Screen>
  );
}

function HubAction({
  icon,
  title,
  body,
  onPress,
  primary = false,
}: {
  icon: IconName;
  title: string;
  body: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.base,
        padding: theme.spacing.base,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: primary ? theme.colors.primary : theme.colors.border,
        backgroundColor: primary
          ? pressed
            ? theme.colors.surfacePressed
            : theme.colors.primarySoft
          : pressed
            ? theme.colors.surfacePressed
            : theme.colors.surface,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? theme.colors.primary : theme.colors.surfaceAlt,
        }}
      >
        <Icon
          name={icon}
          size={22}
          color={primary ? theme.colors.textOnPrimary : theme.colors.text}
        />
      </View>

      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="subheading" color={primary ? 'primaryOnSoft' : 'text'}>
          {title}
        </Text>
        <Text variant="bodySm" color={primary ? 'primaryOnSoft' : 'textMuted'}>
          {body}
        </Text>
      </View>

      <Icon name="chevronRight" size={20} color="textMuted" />
    </Pressable>
  );
}

function Section({
  title,
  subtitle,
  onSeeAll,
  children,
}: {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ gap: theme.spacing.xxs, flex: 1 }}>
          <Text variant="heading">{title}</Text>
          {subtitle ? (
            <Text variant="bodySm" color="textMuted">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onSeeAll ? (
          <Pressable
            onPress={onSeeAll}
            accessibilityRole="button"
            accessibilityLabel={`See all ${title.toLowerCase()}`}
            hitSlop={8}
          >
            <Text variant="bodySmStrong" color="primaryOnSoft">
              See all
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ gap: theme.spacing.sm }}>{children}</View>
    </View>
  );
}

/** One recipe in a list. Shared by the hub and the saved-recipes screen. */
export function RecipeRow({
  recipe,
  onPress,
}: {
  recipe: Recipe;
  onPress: () => void;
}) {
  const theme = useTheme();
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const cuisine = cuisineLabel(recipe.cuisine);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      accessibilityHint="Opens the recipe"
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface,
      })}
    >
      <RecipeImage
        image={recipe.image}
        title={recipe.title}
        height={64}
        style={{ width: 64 }}
      />

      <View style={{ flex: 1, gap: theme.spacing.xs, justifyContent: 'center' }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {recipe.title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {recipe.origin === 'demo_sample' ? (
            <Badge label="Demo" tone="warning" />
          ) : null}
          {cuisine ? <Badge label={cuisine} tone="neutral" /> : null}
          {totalMinutes > 0 ? (
            <Badge label={`${totalMinutes} min`} tone="neutral" />
          ) : null}
          <Badge
            label={`Serves ${recipe.servings}`}
            tone="neutral"
          />
        </View>
      </View>

      <View style={{ justifyContent: 'center' }}>
        <Icon name="chevronRight" size={18} color="textMuted" />
      </View>
    </Pressable>
  );
}
