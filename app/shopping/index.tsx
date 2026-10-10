import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Button,
  EmptyState,
  ErrorState,
  Metric,
  Row,
  Screen,
  SegmentedControl,
  Skeleton,
  Surface,
} from '@/components/ui';
import { useShoppingListRepository, useShoppingLists } from '@/features/recipes';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';
import type { ShoppingListStatus } from '@/types/recipe';

const STATUS_OPTIONS = [
  { value: 'active' as const, label: 'Active' },
  { value: 'archived' as const, label: 'Done' },
];

export default function ShoppingListsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const repository = useShoppingListRepository();
  const [status, setStatus] = useState<ShoppingListStatus>('active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const { lists, loading, error: loadError, reload } = useShoppingLists(status);

  const createList = async () => {
    setBusy(true);
    setError(null);
    const result = await repository.createList({
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
      title="Shopping"
      refreshing={loading}
      onRefresh={reload}
      contentStyle={{ gap: theme.spacing.lg }}
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
          <Skeleton height={76} radius={theme.radius.surface} />
          <Skeleton height={76} radius={theme.radius.surface} />
        </View>
      ) : lists.length === 0 ? (
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
      ) : (
        <Surface variant="grouped">
          {lists.map((list, index) => {
            const outstanding = list.items.filter((item) => !item.isChecked).length;
            return (
              <Row
                key={list.id}
                title={list.name}
                subtitle={
                  list.items.length === 0
                    ? 'Empty'
                    : outstanding === 0
                      ? `All ${list.items.length} ticked off`
                      : `${outstanding} of ${list.items.length} still to buy`
                }
                leading={<Icon name="basket" size={19} color="textMuted" />}
                divided={index > 0}
                trailing={
                  outstanding > 0 ? (
                    <Metric value={String(outstanding)} size="m" color="primaryOnSoft" />
                  ) : (
                    <Icon name="check" size={17} color="success" />
                  )
                }
                onPress={() => router.push(`/shopping/${list.id}`)}
              />
            );
          })}
        </Surface>
      )}
    </Screen>
  );
}
