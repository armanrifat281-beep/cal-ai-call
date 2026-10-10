import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Button,
  Checkbox,
  ErrorState,
  Metric,
  Screen,
  Section,
  Skeleton,
  Surface,
  Text,
  TextField,
} from '@/components/ui';
import {
  formatIngredientAmount,
  useShoppingListRepository,
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
  const [actionError, setActionError] = useState<AppError | null>(null);
  const [copied, setCopied] = useState(false);

  const repository = useShoppingListRepository();

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
    setActionError(null);
    const result = await operation();

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

  const showListActions = () => {
    if (!list) return;
    Alert.alert(list.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...(list.status === 'active'
        ? [{ text: 'Mark list as done', onPress: () => void markDone() }]
        : []),
      { text: 'Delete list', style: 'destructive' as const, onPress: deleteList },
    ]);
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
            const result = await repository.deleteList(list.id);
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

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title1">{list.name}</Text>
          <Text variant="footnote" color="textMuted">
            {list.items.length === 0
              ? 'Empty'
              : outstanding.length === 0
                ? 'Everything ticked off'
                : `${list.items.length} items`}
            {list.status === 'archived' ? '  ·  done' : ''}
          </Text>
        </View>
        {list.items.length > 0 ? (
          <Metric
            value={String(outstanding.length)}
            label="to buy"
            size="l"
            align="right"
            color={outstanding.length === 0 ? 'textMuted' : 'text'}
          />
        ) : null}
      </View>

      {list.items.length === 0 ? (
        <Text variant="body" color="textMuted">
          Nothing on this list yet. Add items below, or open a recipe and add
          everything you still need in one go.
        </Text>
      ) : (
        <>
          {outstanding.length > 0 ? (
            <Surface variant="grouped">
              {outstanding.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  divided={index > 0}
                  onToggle={() => void run(() => repository.setItemChecked(item.id, true))}
                  onDelete={() => void run(() => repository.deleteItem(item.id))}
                />
              ))}
            </Surface>
          ) : (
            <Text variant="body" color="textMuted">
              Everything is ticked off. Clear them when you are done, or mark
              the whole list as done.
            </Text>
          )}

          {ticked.length > 0 ? (
            <Section title={`In the basket (${ticked.length})`} dense>
              <Surface variant="grouped">
                {ticked.map((item, index) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    divided={index > 0}
                    onToggle={() => void run(() => repository.setItemChecked(item.id, false))}
                    onDelete={() => void run(() => repository.deleteItem(item.id))}
                  />
                ))}
              </Surface>
            </Section>
          ) : null}
        </>
      )}

      {/*
        One row of real actions rather than a column of four full-width
        buttons. Destructive and lifecycle actions go in an action sheet,
        which is where a native app keeps them.
      */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button
          label={copied ? 'Copied' : 'Copy list'}
          variant="tonal"
          onPress={() => void copyToClipboard()}
          disabled={outstanding.length === 0}
          leading={
            <Icon
              name={copied ? 'check' : 'copy'}
              size={17}
              color={theme.colors.primaryOnSoft}
            />
          }
          style={{ flex: 1 }}
        />
        {ticked.length > 0 ? (
          <Button
            label={`Clear ${ticked.length}`}
            variant="secondary"
            onPress={clearTicked}
            style={{ flex: 1 }}
          />
        ) : null}
        <Button
          label="More"
          variant="secondary"
          onPress={showListActions}
          accessibilityHint="Mark the list as done, or delete it"
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
  divided,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
  onDelete: () => void;
  divided: boolean;
}) {
  const theme = useTheme();
  const amount = formatIngredientAmount(item.quantity, item.unit);
  const detail = [amount, item.note].filter(
    (part): part is string => Boolean(part && part.length > 0),
  );

  return (
    <View>
      {divided ? (
        <View
          style={{
            height: theme.hairline,
            backgroundColor: theme.colors.separator,
            marginLeft: theme.spacing.base + 24 + theme.spacing.md,
          }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Checkbox
          checked={item.isChecked}
          onChange={onToggle}
          label={item.name}
          detail={detail.join('  ·  ')}
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
    </View>
  );
}
