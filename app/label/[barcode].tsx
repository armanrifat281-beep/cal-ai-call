import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Button,
  Disclosure,
  ErrorState,
  Row,
  Screen,
  Section,
  Skeleton,
  Surface,
  Text,
} from '@/components/ui';
import { lookupBarcode } from '@/features/labels';
import { useAsyncResult } from '@/lib/useAsyncResult';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import type { Nutrients } from '@/types/domain';

/** The rows shown, in the order a label prints them. */
const ROWS: { key: keyof Nutrients; label: string; unit: string }[] = [
  { key: 'caloriesKcal', label: 'Energy', unit: 'kcal' },
  { key: 'fatG', label: 'Fat', unit: 'g' },
  { key: 'saturatedFatG', label: 'of which saturates', unit: 'g' },
  { key: 'carbsG', label: 'Carbohydrate', unit: 'g' },
  { key: 'sugarG', label: 'of which sugars', unit: 'g' },
  { key: 'fiberG', label: 'Fibre', unit: 'g' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'sodiumMg', label: 'Sodium', unit: 'mg' },
];

/**
 * What the packet says, and what it does not.
 *
 * The screen is built around a single rule: a figure the source does not
 * hold is printed as "not stated", never as zero and never quietly left out.
 * A missing fibre figure rendered as "0 g" is a lie that looks like a fact,
 * and the user has no way to tell it from a genuine zero.
 *
 * The same rule governs allergens, and more strictly. Only what the
 * packaging itself declares is shown. The ingredient list is never scanned
 * for allergens to fill a gap: "contains milk" is a legal statement by the
 * manufacturer, and a guess wearing the same words could hurt somebody.
 */
export default function ProductScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ barcode?: string }>();
  const barcode = typeof params.barcode === 'string' ? params.barcode : '';

  const allergens = usePreferencesStore((state) => state.preferences.allergens);
  const allergyAware = usePreferencesStore(
    (state) => state.preferences.allergyAwarenessEnabled,
  );

  // The project's own async hook rather than an effect that sets state:
  // it keeps the previous record on screen while a retry is in flight, and
  // it cancels cleanly when the screen closes mid-request.
  const run = useCallback(() => lookupBarcode(barcode), [barcode]);
  const { data: lookup, loading, error, reload } = useAsyncResult(run, [run]);

  if (loading) {
    return (
      <Screen contentStyle={{ gap: theme.spacing.base }}>
        <Skeleton height={72} radius={theme.radius.surface} />
        <Skeleton height={220} radius={theme.radius.surface} />
        <Skeleton height={120} radius={theme.radius.surface} />
      </Screen>
    );
  }

  if (error || !lookup) {
    return (
      <Screen contentStyle={{ gap: theme.spacing.base }}>
        <ErrorState
          title="Product not found"
          message={error?.message ?? 'We could not read that product.'}
          detail={error?.detail}
          onRetry={error?.retryable ? reload : undefined}
        />
        <Button
          label="Add it by hand instead"
          variant="tonal"
          onPress={() => router.replace('/entry/new')}
          fullWidth
        />
      </Screen>
    );
  }

  const { product, gaps } = lookup;

  // Only the user's own declared allergens, matched against the packet's own
  // declaration. Never against the ingredient text.
  const flagged = allergyAware
    ? allergens.filter((own) =>
        product.declaredAllergens.some((declared) =>
          declared.toLowerCase().includes(own.trim().toLowerCase()),
        ),
      )
    : [];

  return (
    <Screen
      title={product.name ?? 'Unnamed product'}
      subtitle={product.brand ?? undefined}
      contentStyle={{ gap: theme.spacing.lg }}
    >
      {flagged.length > 0 ? (
        <Surface
          variant="grouped"
          padding="base"
          style={{
            gap: theme.spacing.xs,
            borderWidth: 1,
            borderColor: theme.colors.danger,
          }}
        >
          <Text variant="label" color="danger">
            {`THIS PACKET DECLARES ${flagged.join(', ').toUpperCase()}`}
          </Text>
          <Text variant="caption" color="textMuted">
            From the packaging’s own allergen statement, which you asked us to
            watch for.
          </Text>
        </Surface>
      ) : null}

      <Section title="Per 100 g" dense>
        <Surface variant="grouped">
          {ROWS.map((row, index) => {
            const value = product.per100g[row.key];
            const stated = !gaps.missingNutrients.includes(row.key);

            return (
              <Row
                key={row.key}
                title={row.label}
                divided={index > 0}
                trailing={
                  stated ? (
                    <Text variant="body" style={{ fontWeight: '600' }}>
                      {`${Math.round((value ?? 0) * 10) / 10} ${row.unit}`}
                    </Text>
                  ) : (
                    /*
                      The whole point of the screen. A blank figure rendered
                      as "0 g" is indistinguishable from a real zero.
                    */
                    <Text variant="footnote" color="textSubtle">
                      not stated
                    </Text>
                  )
                }
              />
            );
          })}
        </Surface>

        {product.servingSize ? (
          <Text variant="caption" color="textMuted">
            {`Serving: ${product.servingSize}`}
          </Text>
        ) : (
          <Text variant="caption" color="textSubtle">
            This record has no serving size, so only per-100 g figures are
            shown.
          </Text>
        )}
      </Section>

      <Section title="Ingredients" dense>
        {gaps.missingIngredients ? (
          <Disclosure
            summary="No ingredient list in this record"
            detail="The open database has no ingredients for this product. Read them off the packet - nothing has been filled in here."
            tone="caution"
          />
        ) : (
          <Surface variant="grouped" padding="base">
            <Text variant="body">{product.ingredients.join(', ')}</Text>
          </Surface>
        )}
      </Section>

      <Section title="Declared allergens" dense>
        {gaps.missingAllergens ? (
          <Disclosure
            summary="No allergen statement in this record"
            detail="This is not the same as the product being free of allergens. Nothing here is inferred from the ingredient list - check the packet itself."
            tone="caution"
          />
        ) : (
          <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.xs }}>
            <Text variant="body">{product.declaredAllergens.join(', ')}</Text>
            <Text variant="caption" color="textSubtle">
              As declared on the packaging.
            </Text>
          </Surface>
        )}
      </Section>

      <Surface variant="grouped" padding="base" style={{ gap: theme.spacing.xs }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
        >
          <Icon name="database" size={16} color="textMuted" />
          <Text variant="label" color="textMuted">
            WHERE THIS CAME FROM
          </Text>
        </View>
        <Text variant="caption" color="textMuted">
          {`Open Food Facts, an open database edited by the public — barcode ${product.barcode}. It can be out of date or wrong; the packet in your hand is the authority.`}
        </Text>
      </Surface>

      <Button
        label="Scan another"
        variant="tonal"
        onPress={() => router.replace('/label/scan')}
        leading={<Icon name="scan" size={16} color="text" />}
        fullWidth
      />
    </Screen>
  );
}
