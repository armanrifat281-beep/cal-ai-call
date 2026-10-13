import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Screen, Surface, Text, TextField } from '@/components/ui';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';

/** Enough for a real kitchen, few enough to stay a list and not a database. */
const MAX_ITEMS = 40;

/**
 * What you have at home.
 *
 * One text box, not a picker. People keep "half a cabbage" and "that jar of
 * paste", and a catalogue of known foods would force them to either lie or
 * leave things out - so the list is their own words, and the matching that
 * reads it is deliberately literal about what it cannot recognise.
 *
 * It earns its place by being read in two directions: the recipe creator
 * starts from it instead of asking again, and every recipe screen uses it to
 * say which ingredients are missing before you go shopping.
 *
 * Stored on the device, like every other preference. It is not yet synced to
 * an account, so it does not follow the user to another phone.
 */
export default function KitchenScreen() {
  const theme = useTheme();
  const router = useRouter();

  const stored = usePreferencesStore((state) => state.preferences.pantryItems);
  const setPantryItems = usePreferencesStore((state) => state.setPantryItems);

  const [text, setText] = useState(stored.join(', '));
  const [saved, setSaved] = useState(false);

  const items = text
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const tooMany = items.length > MAX_ITEMS;

  const save = () => {
    if (tooMany) return;
    setPantryItems(items);
    setSaved(true);
  };

  return (
    <Screen title="My kitchen" contentStyle={{ gap: theme.spacing.lg }}>
      <Text variant="body" color="textMuted">
        List what you keep at home, separated by commas. Recipes will show
        which ingredients you already have and which you need to buy.
      </Text>

      <TextField
        label="Ingredients at home"
        value={text}
        onChangeText={(next) => {
          setText(next);
          setSaved(false);
        }}
        placeholder="rice, eggs, onions, yoghurt, cumin"
        multiline
        numberOfLines={6}
        autoCapitalize="none"
        error={
          tooMany
            ? `That is ${items.length} items. Keep it to ${MAX_ITEMS} or fewer.`
            : null
        }
      />

      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label={saved ? 'Saved' : 'Save'}
          onPress={save}
          disabled={tooMany || saved}
          fullWidth
          haptic
        />
        {saved ? (
          <Text
            variant="caption"
            color="textMuted"
            accessibilityLiveRegion="polite"
          >
            {items.length === 0
              ? 'Your kitchen list is empty, so recipes will not mention what you have.'
              : `${items.length} item${items.length === 1 ? '' : 's'} saved.`}
          </Text>
        ) : null}
      </View>

      {/*
        Said plainly, because the matching is literal and will get some of
        these wrong in the safe direction. A user who knows that reads
        "missing" as "check the shelf" rather than as a fact.
      */}
      <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.xs }}>
        <Text variant="label" color="textMuted">
          HOW THIS IS MATCHED
        </Text>
        <Text variant="caption" color="textMuted">
          Names are compared literally, so “spring onions” here will not match
          a recipe asking for “scallions”. Anything it cannot recognise is
          listed as missing rather than assumed — check the list before you
          shop.
        </Text>
      </Surface>

      <Button
        label="Done"
        variant="ghost"
        onPress={() => router.back()}
        fullWidth
      />
    </Screen>
  );
}
