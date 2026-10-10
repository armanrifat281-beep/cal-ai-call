import type { DateKey } from '@/lib/date';
import type { Result } from '@/lib/result';
import type {
  FoodEntry,
  FoodEntryItem,
  MealType,
  SavedMeal,
} from '@/types/domain';

/**
 * The journal data contract.
 *
 * Both the local (device-only) store and the Supabase-backed store implement
 * this, so screens never know or care which one is active. That is what lets
 * the app be fully usable before a backend is configured, and lets us switch
 * to the server without touching the UI.
 */
export interface JournalRepository {
  /** A label for the UI, e.g. "On this device" or "Synced". */
  readonly kind: 'local' | 'supabase';

  listEntriesForDay(dateKey: DateKey): Promise<Result<FoodEntry[]>>;
  /** Inclusive range, used by the weekly summaries and Insights. */
  listEntriesForRange(startKey: DateKey, endKey: DateKey): Promise<Result<FoodEntry[]>>;
  getEntry(entryId: string): Promise<Result<FoodEntry | null>>;
  createEntry(input: CreateEntryInput): Promise<Result<FoodEntry>>;
  updateEntry(entryId: string, patch: UpdateEntryPatch): Promise<Result<FoodEntry>>;
  deleteEntry(entryId: string): Promise<Result<void>>;
  /** Copy an entry to a new time, for "log this again". */
  duplicateEntry(entryId: string, options: DuplicateEntryOptions): Promise<Result<FoodEntry>>;
  /** Most recently logged entries, newest first, for quick re-entry. */
  listRecentEntries(limit: number): Promise<Result<FoodEntry[]>>;

  listSavedMeals(): Promise<Result<SavedMeal[]>>;
  createSavedMeal(input: CreateSavedMealInput): Promise<Result<SavedMeal>>;
  deleteSavedMeal(savedMealId: string): Promise<Result<void>>;
  /** Bump use count and timestamp when a saved meal is logged again. */
  recordSavedMealUse(savedMealId: string): Promise<Result<SavedMeal>>;
}

export interface CreateEntryInput {
  /** ISO instant the food was eaten. Defaults to now when omitted. */
  consumedAt?: string;
  mealType: MealType;
  title: string;
  items: FoodEntryItem[];
  photoPath?: string | null;
  notes?: string | null;
}

export interface UpdateEntryPatch {
  consumedAt?: string;
  mealType?: MealType;
  title?: string;
  items?: FoodEntryItem[];
  photoPath?: string | null;
  notes?: string | null;
}

export interface DuplicateEntryOptions {
  /** ISO instant for the copy. Defaults to now. */
  consumedAt?: string;
  /** Meal type for the copy. Defaults to the original's. */
  mealType?: MealType;
}

export interface CreateSavedMealInput {
  name: string;
  mealType: MealType | null;
  items: FoodEntryItem[];
}
