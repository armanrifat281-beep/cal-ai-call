import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A recording stand-in for the Supabase client.
 *
 * It implements just enough of the PostgREST builder to let the repository run
 * unchanged, records what was asked for, and returns whatever the test
 * programs. That makes three things testable without a project:
 *
 *  - the queries built (table, filters, ordering, limits);
 *  - the row-to-domain mapping, including numeric coercion;
 *  - error handling, by programming a PostgrestError or a thrown value.
 *
 * It is NOT a Postgres emulator. Row Level Security, constraints and the
 * database functions are tested for real against a local Postgres instance by
 * `scripts/test-db.sh`.
 */

export type FilterTuple = [op: string, column: string, value: unknown];

export interface RecordedQuery {
  kind: 'query';
  table: string;
  /** 'select' | 'insert' | 'update' | 'delete' */
  operation: string;
  selectColumns?: string;
  values?: unknown;
  filters: FilterTuple[];
  orders: { column: string; ascending: boolean; nullsFirst?: boolean }[];
  limit?: number;
  /** Set when the caller asked for a single row. */
  single?: 'maybe' | 'one';
  countOption?: string;
}

export interface RecordedRpc {
  kind: 'rpc';
  name: string;
  args: Record<string, unknown>;
}

export type RecordedCall = RecordedQuery | RecordedRpc;

export interface FakeResponse {
  data?: unknown;
  error?: { code?: string; message: string; details?: string; hint?: string } | null;
  count?: number | null;
  /** When set, the call rejects with this instead of resolving. */
  throws?: unknown;
}

export interface FakeSupabaseOptions {
  /** Answers a table query. Returning undefined yields empty data. */
  onQuery?: (call: RecordedQuery) => FakeResponse | undefined;
  /** Answers an rpc call. Returning undefined yields null data. */
  onRpc?: (call: RecordedRpc) => FakeResponse | undefined;
}

export interface FakeSupabase {
  /** Cast to the real client type for injection into the repository. */
  client: SupabaseClient;
  /** Every call made, in order. */
  calls: RecordedCall[];
  /** Convenience: the calls that were table queries. */
  queries: RecordedQuery[];
  /** Convenience: the calls that were rpc invocations. */
  rpcs: RecordedRpc[];
  reset: () => void;
}

/** A thenable query builder, so `await` on a partially built chain works. */
class FakeQueryBuilder implements PromiseLike<unknown> {
  constructor(
    private readonly record: RecordedQuery,
    private readonly settle: (call: RecordedQuery) => Promise<unknown>,
  ) {}

  select(columns?: string): this {
    if (this.record.operation === 'select' || columns !== undefined) {
      this.record.selectColumns = columns ?? '*';
    }
    return this;
  }

  insert(values: unknown): this {
    this.record.operation = 'insert';
    this.record.values = values;
    return this;
  }

  update(values: unknown): this {
    this.record.operation = 'update';
    this.record.values = values;
    return this;
  }

  delete(options?: { count?: string }): this {
    this.record.operation = 'delete';
    if (options?.count) this.record.countOption = options.count;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.record.filters.push(['eq', column, value]);
    return this;
  }

  neq(column: string, value: unknown): this {
    this.record.filters.push(['neq', column, value]);
    return this;
  }

  gte(column: string, value: unknown): this {
    this.record.filters.push(['gte', column, value]);
    return this;
  }

  lte(column: string, value: unknown): this {
    this.record.filters.push(['lte', column, value]);
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.record.filters.push(['in', column, values]);
    return this;
  }

  /** `.is('col', null)`, which is how PostgREST asks for SQL NULL. */
  is(column: string, value: unknown): this {
    this.record.filters.push(['is', column, value]);
    return this;
  }

  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): this {
    this.record.orders.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(count: number): this {
    this.record.limit = count;
    return this;
  }

  maybeSingle(): this {
    this.record.single = 'maybe';
    return this;
  }

  single(): this {
    this.record.single = 'one';
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onFulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.settle(this.record).then(onFulfilled, onRejected);
  }
}

export function createFakeSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  const calls: RecordedCall[] = [];

  async function settleQuery(record: RecordedQuery): Promise<unknown> {
    const response = options.onQuery?.(record);
    if (response?.throws !== undefined) throw response.throws;

    if (response?.error) {
      return { data: null, error: response.error, count: null };
    }

    const data = response?.data;
    // Mirror PostgREST: a single-row request returns an object, not an array.
    if (record.single) {
      const row = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
      return { data: row, error: null, count: response?.count ?? null };
    }

    return {
      data: data ?? [],
      error: null,
      count: response?.count ?? null,
    };
  }

  async function settleRpc(record: RecordedRpc): Promise<unknown> {
    const response = options.onRpc?.(record);
    if (response?.throws !== undefined) throw response.throws;
    if (response?.error) return { data: null, error: response.error };
    return { data: response?.data ?? null, error: null };
  }

  const client = {
    from(table: string) {
      const record: RecordedQuery = {
        kind: 'query',
        table,
        operation: 'select',
        filters: [],
        orders: [],
      };
      calls.push(record);
      return new FakeQueryBuilder(record, settleQuery);
    },
    rpc(name: string, args: Record<string, unknown> = {}) {
      const record: RecordedRpc = { kind: 'rpc', name, args };
      calls.push(record);
      return {
        then<T1, T2>(
          onFulfilled?: ((value: unknown) => T1 | PromiseLike<T1>) | null,
          onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
        ) {
          return settleRpc(record).then(onFulfilled, onRejected);
        },
      };
    },
  };

  return {
    // The fake implements only the surface the repository uses, so the cast is
    // narrowed in one place rather than at every call site.
    client: client as unknown as SupabaseClient,
    calls,
    get queries() {
      return calls.filter((call): call is RecordedQuery => call.kind === 'query');
    },
    get rpcs() {
      return calls.filter((call): call is RecordedRpc => call.kind === 'rpc');
    },
    reset() {
      calls.length = 0;
    },
  };
}
