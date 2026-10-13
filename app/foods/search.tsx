import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { SourceBadge } from '@/components/nutrition';
import {
  Appear,
  Disclosure,
  EmptyState,
  ErrorState,
  Row,
  Screen,
  Skeleton,
  Surface,
  Text,
  TextField,
} from '@/components/ui';
import { getSearchAvailability, searchFoods } from '@/features/foods';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';
import type { FoodRecord } from '@/types/domain';

/**
 * Looking a food up.
 *
 * The third way to log a meal, and the one that needs no camera and no AI
 * key: every row here is a measured record rather than an estimate, which
 * is why each carries a source badge and why tapping one logs it as a
 * `database` lookup.
 *
 * The search is debounced rather than run on every keystroke. Each call
 * spends a request against a shared rate limit, and "chicken breast" typed
 * at speed would otherwise be fourteen searches for one answer.
 */
const DEBOUNCE_MS = 400;
const MIN_QUERY = 2;

/**
 * The line under a food's name.
 *
 * Macros rather than the brand alone: three numbers are what tells two
 * similar-looking records apart, and most results have no brand at all.
 */
function describe(record: FoodRecord): string {
  const n = record.nutrientsPer100g;
  const macros = `P ${Math.round(n.proteinG)} · C ${Math.round(n.carbsG)} · F ${Math.round(n.fatG)}`;
  return record.brand === null ? macros : `${record.brand} · ${macros}`;
}

export default function FoodSearchScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly FoodRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [searched, setSearched] = useState(false);

  const availability = getSearchAvailability();

  // Only the newest search may write results. Without this a slow search for
  // "chi" can land after a fast one for "chicken" and replace it.
  const latest = useRef(0);

  const run = useCallback(async (text: string) => {
    const ticket = ++latest.current;

    setLoading(true);
    setError(null);
    const result = await searchFoods(text);

    if (ticket !== latest.current) return;
    setLoading(false);
    setSearched(true);

    if (!result.ok) {
      setError(result.error);
      setResults([]);
      return;
    }
    setResults(result.value);
  }, []);

  const text = query.trim();
  // Derived, not stored. Clearing results from the effect would be a
  // synchronous setState in an effect - a cascading render, and the thing
  // React warns about - when the same answer falls out of what is on screen.
  const tooShort = text.length < MIN_QUERY;

  useEffect(() => {
    if (tooShort) {
      // Nothing to cancel but the newest ticket still moves, so a search
      // already in flight cannot land after the box was cleared.
      latest.current += 1;
      return;
    }

    const timer = setTimeout(() => void run(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, tooShort, run]);

  const open = (record: FoodRecord) => {
    router.push({
      pathname: '/foods/portion',
      // The whole record travels, so the next screen needs no second lookup
      // and the figures the user just read are the figures they get.
      params: { food: JSON.stringify(record) },
    });
  };

  return (
    <Screen title="Search a food" edges={{ top: true }}>
      <TextField
        label="Food"
        value={query}
        onChangeText={setQuery}
        placeholder="Chicken breast, oats, banana…"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="search"
      />

      {!availability.available ? (
        <Disclosure
          summary="Food search is not set up in this build"
          detail={`${availability.reason} Everything else works, and a meal you type in yourself carries your own numbers rather than an estimate.`}
          tone="caution"
        />
      ) : null}

      {error ? (
        <ErrorState
          message={error.message}
          detail={error.detail}
          onRetry={error.retryable ? () => void run(query.trim()) : undefined}
        />
      ) : null}

      {loading && !tooShort ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : null}

      {!loading && !tooShort && searched && results.length === 0 && error === null ? (
        <EmptyState
          title="Nothing matched"
          body="Try a simpler word - 'rice' rather than 'basmati rice cooked'. Foods with no calorie or macro figures are left out, because a record without them could only be logged as zero."
          illustration={<Icon name="search" size={34} color="textMuted" strokeWidth={1.4} />}
        />
      ) : null}

      {!tooShort && results.length > 0 ? (
        <Appear>
          <View style={{ gap: theme.spacing.sm }}>
            {/*
              Said once, not on every row. Every result here comes from the
              same place with the same confidence, so a badge per row would
              repeat one claim twenty times and take the width the food's
              name needs - these names run long ("Chicken breast tenders,
              breaded, uncooked").
            */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <SourceBadge source="database" confidence="high" />
              <Text variant="caption" color="textSubtle">
                Measured records · figures per 100 g
              </Text>
            </View>

            <Surface variant="grouped">
              {results.map((record, index) => (
                <Row
                  key={record.id}
                  title={record.name}
                  subtitle={describe(record)}
                  divided={index > 0}
                  trailing={
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.md,
                      }}
                    >
                      <Text variant="metricS">
                        {Math.round(record.nutrientsPer100g.caloriesKcal)}
                      </Text>
                      <Icon name="plus" size={17} color="textMuted" />
                    </View>
                  }
                  onPress={() => open(record)}
                  haptic
                />
              ))}
            </Surface>

            <Text variant="caption" color="textSubtle">
              Set the amount you ate on the next screen.
            </Text>
          </View>
        </Appear>
      ) : null}

    </Screen>
  );
}
