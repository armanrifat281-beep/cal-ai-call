import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  ErrorState,
  InfoNote,
  Screen,
  Skeleton,
  Text,
  TextField,
} from '@/components/ui';
import {
  formatIngredientAmount,
  getShoppingListRepository,
  useShoppingList,
} from '@/features/recipes';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';
import type { ShoppingListItem } from '@/types/recipe';

/**
 * One shopping list.
 *
 * Ticking an item off keeps it visible but struck through, because in a shop
 * you want to see what you have already picked up. "Clear ticked" removes
 * them when the trip is over.
 */
export default function ShoppingListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { list, loading, error, notFound, reload, setList } = useShoppingList(id);

  const [newItem, setNewItem] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<AppError | null>(null);
  const [copied, setCopied] = useState(false);

  const repository = getShoppingListRepository();

  const outstanding = useMemo(
    () => (list ? list.items.filter((item) => !item.isChecked) : []),
    [list],
  );
  const ticked = useMemo(
    () => (list ? list.items.filter((item) => item.isChecked) : []),
    [list],
  );

  /** Runs a mutation and swaps in the returned list, avoiding a refetch. */
  const run = async (operation: () => Promise<Awaited<ReturnType<typeof repository.addItems>>>) => {
    setBusy(true);
    setActionError(null);
    const result = await operation();
    setBusy(false);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setList(result.value);
  };

  const addItem = async () => {
    const name = newItem.trim();
    if (!list || name.length === 0) return;
    setNewItem('');
    await run(() => repository.addItems(list.id, [{ name }]));
  };

  const copyToClipboard = async () => {
    if (!list) return;
    const text = [
      list.name,
      '',
      ...outstanding.map((item) => `- ${formatItemLine(item)}`),
    ].join('\n');

    await Clipboard.setStringAsync(text);
    setCopied(true);
    // The confirmation is transient: a permanent "copied" label is confusing.
    setTimeout(() => setCopied(false), 2200);
  };

  const clearTicked = () => {
    if (!list || ticked.length === 0) return;
    Alert.alert(
      'Clear ticked items?',
      `${ticked.length} item${ticked.length === 1 ? '' : 's'} will be removed from this list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => void run(() => repository.clearChecked(list.id)),
        },
      ],
    );
  };

  const markDone = async () => {
    if (!list) return;
    await run(() => repository.setListStatus(list.id, 'archived'));
    router.back();
  };

  const deleteList = () => {
    if (!list) return;
    Alert.alert('Delete this list?', 'This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            const result = await repository.deleteList(list.id);
            setBusy(false);
            if (!result.ok) setActionError(result.error);
            else router.back();
          })();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen contentStyle={{ gap: theme.spacing.base }}>
        <Skeleton width="60%" height={24} />
        <Skeleton height={56} />
        <Skeleton height={56} />
        <Skeleton height={56} />
      </Screen>
    );
  }

  if (notFound) {
    return (
      <Screen>
        <ErrorState
          title="List not found"
          message="This shopping list no longer exists."
          onRetry={() => router.back()}
          retryLabel="Go back"
        />
      </Screen>
    );
  }

  if (error || !list) {
    return (
      <Screen>
        <ErrorState
          message={error?.message ?? 'We could not open this list.'}
          detail={error?.detail}
          onRetry={reload}
        />
      </Screen>
    );
  }

  navigation.setOptions({ title: list.name });

  return (
    <Screen
      contentStyle={{ gap: theme.spacing.base }}
      footer={
        <>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <TextField
              label="Add an item"
              value={newItem}
              onChangeText={setNewItem}
              placeholder="Olive oil"
              onSubmitEditing={() => void addItem()}
              returnKeyType="done"
              autoCapitalize="sentences"
              containerStyle={{ flex: 1 }}
            />
            <Button
              label="Add"
              variant="tonal"
              onPress={() => void addItem()}
              disabled={newItem.trim().length === 0}
            />
          </View>
        </>
      }
    >
      {actionError ? (
        <ErrorState message={actionError.message} detail={actionError.detail} />
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title1">{list.name}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          <Badge
            label={
              list.items.length === 0
                ? 'Empty'
                : `${outstanding.length} of ${list.items.length} to buy`
            }
            tone={outstanding.length === 0 && list.items.length > 0 ? 'success' : 'primary'}
          />
          {list.status === 'archived' ? <Badge label="Done" tone="neutral" /> : null}
        </View>
      </View>

      {list.items.length === 0 ? (
        <InfoNote
          body="Nothing on this list yet. Add items below, or open a recipe and add everything you still need in one go."
          tone="neutral"
        />
      ) : (
        <>
          {outstanding.length > 0 ? (
            <Card padding="none">
              {outstanding.map((item, index) => (
                <View key={item.id}>
                  {index > 0 ? <Divider inset={theme.spacing.base} /> : null}
                  <ItemRow
                    item={item}
                    onToggle={() =>
                      void run(() => repository.setItemChecked(item.id, true))
                    }
                    onDelete={() => void run(() => repository.deleteItem(item.id))}
                  />
                </View>
              ))}
            </Card>
          ) : (
            <InfoNote
              title="Everything ticked off"
              body="Clear the ticked items when you are done, or mark the whole list as done."
              tone="info"
            />
          )}

          {ticked.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="label" color="textMuted">
                IN THE BASKET ({ticked.length})
              </Text>
              <Card padding="none">
                {ticked.map((item, index) => (
                  <View key={item.id}>
                    {index > 0 ? <Divider inset={theme.spacing.base} /> : null}
                    <ItemRow
                      item={item}
                      onToggle={() =>
                        void run(() => repository.setItemChecked(item.id, false))
                      }
                      onDelete={() => void run(() => repository.deleteItem(item.id))}
                    />
                  </View>
                ))}
              </Card>
            </View>
          ) : null}
        </>
      )}

      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label={copied ? 'Copied to clipboard' : 'Copy the list'}
          variant="tonal"
          onPress={() => void copyToClipboard()}
          disabled={outstanding.length === 0}
          fullWidth
          leading={<Icon name={copied ? 'check' : 'copy'} size={18} color="text" />}
        />
        {ticked.length > 0 ? (
          <Button
            label={`Clear ${ticked.length} ticked item${ticked.length === 1 ? '' : 's'}`}
            variant="ghost"
            size="sm"
            onPress={clearTicked}
            fullWidth
          />
        ) : null}
        {list.status === 'active' ? (
          <Button
            label="Mark this list as done"
            variant="ghost"
            size="sm"
            onPress={() => void markDone()}
            loading={busy}
            fullWidth
          />
        ) : null}
        <Button
          label="Delete this list"
          variant="ghost"
          size="sm"
          onPress={deleteList}
          fullWidth
        />
      </View>
    </Screen>
  );
}

/** "2 cloves garlic", or just the name when there is no amount. */
function formatItemLine(item: ShoppingListItem): string {
  const amount = formatIngredientAmount(item.quantity, item.unit);
  return amount.length > 0 ? `${amount} ${item.name}` : item.name;
}

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const amount = formatIngredientAmount(item.quantity, item.unit);

  const detail = [amount, item.note].filter(
    (part): part is string => Boolean(part && part.length > 0),
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Checkbox
        checked={item.isChecked}
        onChange={onToggle}
        label={item.name}
        detail={detail.join(' - ')}
        style={{ flex: 1 }}
      />
      <View style={{ paddingRight: theme.spacing.sm }}>
        <Button
          label="Remove"
          variant="ghost"
          size="sm"
          onPress={onDelete}
          accessibilityHint={`Removes ${item.name} from this list`}
        />
      </View>
    </View>
  );
}
