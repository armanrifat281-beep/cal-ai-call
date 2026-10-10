import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import { getShoppingListRepository, useShoppingLists } from '@/features/recipes';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';
import type { ShoppingList, ShoppingListStatus } from '@/types/recipe';

const STATUS_OPTIONS = [
  { value: 'active' as const, label: 'Active' },
  { value: 'archived' as const, label: 'Done' },
];

export default function ShoppingListsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [status, setStatus] = useState<ShoppingListStatus>('active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const { lists, loading, error: loadError, reload } = useShoppingLists(status);

  const createList = async () => {
    setBusy(true);
    setError(null);
    const result = await getShoppingListRepository().createList({
      name: 'Shopping list',
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/shopping/${result.value.id}`);
  };

  return (
    <Screen
      refreshing={loading}
      onRefresh={reload}
      contentStyle={{ gap: theme.spacing.base }}
      footer={
        <Button
          label="New shopping list"
          onPress={() => void createList()}
          loading={busy}
          size="lg"
          fullWidth
          leading={<Icon name="plus" size={20} color={theme.colors.textOnPrimary} />}
        />
      }
    >
      <SegmentedControl
        options={STATUS_OPTIONS}
        value={status}
        onChange={setStatus}
        accessibilityLabel="Which lists to show"
      />

      {error ? <ErrorState message={error.message} detail={error.detail} /> : null}

      {loadError ? (
        <ErrorState
          message={loadError.message}
          detail={loadError.detail}
          onRetry={loadError.retryable ? reload : undefined}
        />
      ) : loading && lists.length === 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Skeleton height={76} radius={theme.radius.lg} />
          <Skeleton height={76} radius={theme.radius.lg} />
        </View>
      ) : lists.length === 0 ? (
        <Card variant="soft" padding="none">
          <EmptyState
            title={status === 'active' ? 'No shopping lists' : 'Nothing finished yet'}
            body={
              status === 'active'
                ? 'Open a recipe, tick off what you already have, and add the rest to a list.'
                : 'Lists you mark as done end up here.'
            }
            illustration={<Icon name="basket" size={44} color="primary" />}
            actionLabel={status === 'active' ? 'Browse recipes' : undefined}
            onAction={status === 'active' ? () => router.push('/(tabs)/recipes') : undefined}
          />
        </Card>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {lists.map((list) => (
            <ListRowCard
              key={list.id}
              list={list}
              onPress={() => router.push(`/shopping/${list.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function ListRowCard({ list, onPress }: { list: ShoppingList; onPress: () => void }) {
  const theme = useTheme();
  const outstanding = list.items.filter((item) => !item.isChecked).length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${list.name}, ${outstanding} item${outstanding === 1 ? '' : 's'} left`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.base,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface,
      })}
    >
      <Icon name="basket" size={22} color="textMuted" />
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="bodyStrong">{list.name}</Text>
        <Text variant="bodySm" color="textMuted">
          {list.items.length === 0
            ? 'Empty'
            : outstanding === 0
              ? `All ${list.items.length} items ticked off`
              : `${outstanding} of ${list.items.length} still to buy`}
        </Text>
      </View>
      {outstanding > 0 ? <Badge label={String(outstanding)} tone="primary" /> : null}
      <Icon name="chevronRight" size={18} color="textMuted" />
    </Pressable>
  );
}
