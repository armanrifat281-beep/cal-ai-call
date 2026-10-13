import { searchFoods } from '../service';

jest.mock('@/lib/env', () => ({
  env: { isSupabaseConfigured: true },
}));

const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ functions: { invoke: mockInvoke } }),
}));

const USABLE = {
  id: 'usda:171477',
  name: 'Chicken breast, grilled',
  brand: null,
  nutrientsPer100g: {
    caloriesKcal: 165,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
    fiberG: null,
    sugarG: null,
    saturatedFatG: null,
    sodiumMg: 74,
  },
  providerLabel: 'USDA FoodData Central',
  providerRef: '171477',
  isGeneric: true,
};

beforeEach(() => mockInvoke.mockReset());

describe('searchFoods', () => {
  it('returns the records the server sent', async () => {
    mockInvoke.mockResolvedValue({ data: { records: [USABLE] }, error: null });

    const result = await searchFoods('chicken');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.providerLabel).toBe('USDA FoodData Central');
  });

  describe('records it will not show', () => {
    /*
      A row wearing a provider badge is the strongest claim this app makes
      about a number, so it has to actually be one. A record missing its
      macros could only be logged as zero calories - which would look
      authoritative and be wrong.
    */
    it('drops one with a macro missing', async () => {
      const broken = {
        ...USABLE,
        nutrientsPer100g: { ...USABLE.nutrientsPer100g, proteinG: null },
      };
      mockInvoke.mockResolvedValue({ data: { records: [broken, USABLE] }, error: null });

      const result = await searchFoods('chicken');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(1);
    });

    it('drops one with no name', async () => {
      mockInvoke.mockResolvedValue({
        data: { records: [{ ...USABLE, name: '   ' }] },
        error: null,
      });

      const result = await searchFoods('chicken');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it('keeps an optional nutrient that is genuinely unknown', async () => {
      mockInvoke.mockResolvedValue({ data: { records: [USABLE] }, error: null });

      const result = await searchFoods('chicken');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Null, not zero: the record did not say, and neither will the app.
      expect(result.value[0]?.nutrientsPer100g.fiberG).toBeNull();
    });
  });

  describe('failures', () => {
    it('treats a server that is not set up as permanent, not retryable', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: Object.assign(new Error('non-2xx'), {
          // A real FunctionsHttpError carries the Response itself, which has
          // both `json` and `clone`.
          context: {
            status: 503,
            json: async () => ({ error: { message: 'Food search is not set up yet.' } }),
            clone: () => ({
              json: async () => ({ error: { message: 'Food search is not set up yet.' } }),
            }),
          },
        }),
      });

      const result = await searchFoods('chicken');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('not_configured');
      expect(result.error.retryable).toBe(false);
      expect(result.error.message).toBe('Food search is not set up yet.');
    });

    it('says to wait when the provider is rate limited', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: Object.assign(new Error('non-2xx'), { context: { status: 429 } }),
      });

      const result = await searchFoods('chicken');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('rate_limited');
    });

    it('reports an unreadable response rather than showing nothing', async () => {
      mockInvoke.mockResolvedValue({ data: { notRecords: true }, error: null });

      const result = await searchFoods('chicken');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('provider_error');
    });
  });
});
