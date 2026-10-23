import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * The copies of meal photos that are NOT on this device.
 *
 * `store.ts` keeps photos on the phone. When "Keep my meal photos" is on,
 * `analyze-meal` also uploads each photograph to the `meal-photos` bucket
 * and records its path on the entry. Turning the setting off used to clear
 * only the phone's folder, so the promise the toggle makes - "turning this
 * off also deletes photos already saved" - held for half of what was saved.
 *
 * Both halves are reachable from the client: the bucket's policies let a
 * user delete objects under their own uid, and `food_entries: update own`
 * lets them clear the path that pointed at one. No server function and no
 * migration is needed, so nothing here requires a deploy.
 *
 * What is NOT covered, and is not claimed anywhere: the copy the photograph
 * made when it was sent to the analysis provider. That is Google's to keep
 * or discard under their terms, and no request from this app removes it.
 *
 * Dish photos - the ones a user attaches to their own recipe - are a
 * different collection, governed by a deliberate act each time rather than
 * by this setting, and are left alone.
 */

const BUCKET = 'meal-photos';
/** Supabase caps a listing; walk it rather than trusting one page. */
const PAGE = 100;

export interface ForgottenPhotos {
  /** Objects removed from the bucket. */
  removed: number;
  /** Entries whose stored path was cleared. */
  cleared: number;
}

/**
 * Delete this account's stored meal photos and the references to them.
 *
 * Returns ok with zeroes when there is no account: a local-only user has
 * nothing stored, so clearing the device is the whole job and the caller
 * should treat that as success rather than as "nothing happened".
 */
export async function forgetStoredMealPhotos(): Promise<Result<ForgottenPhotos>> {
  const client = getSupabaseClient();
  if (!client) return ok({ removed: 0, cleared: 0 });

  try {
    const { data: auth } = await client.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return ok({ removed: 0, cleared: 0 });

    // ---- the objects -----------------------------------------------------
    const paths: string[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await client.storage
        .from(BUCKET)
        .list(userId, { limit: PAGE, offset });

      if (error) throw error;
      const page = data ?? [];
      // A folder entry has no id. Only files can be removed.
      paths.push(...page.filter((item) => item.id !== null).map((item) => `${userId}/${item.name}`));
      if (page.length < PAGE) break;
    }

    let removed = 0;
    if (paths.length > 0) {
      const { data, error } = await client.storage.from(BUCKET).remove(paths);
      if (error) throw error;

      removed = data?.length ?? 0;
      // `remove` reports what it deleted. Fewer back than asked for means
      // some object survived, and saying "deleted" then would be a lie.
      if (removed < paths.length) {
        return err(
          appError(
            'provider_error',
            `Deleted ${removed} of ${paths.length} stored photos. The rest are still there - try again.`,
            { detail: `storage.remove returned ${removed}/${paths.length}` },
          ),
        );
      }
    }

    // ---- the references --------------------------------------------------
    // Cleared after the objects, so a failure here leaves a path pointing at
    // something already gone - which reads as a missing photo - rather than
    // a path pointing at a photo the user believes was deleted.
    const { data: clearedRows, error: clearError } = await client
      .from('food_entries')
      .update({ photo_path: null })
      .eq('user_id', userId)
      .not('photo_path', 'is', null)
      .select('id');

    if (clearError) throw clearError;

    return ok({ removed, cleared: clearedRows?.length ?? 0 });
  } catch (cause) {
    logger.warn('stored meal photos were not cleared', { cause: String(cause) });
    return err(
      appError('network', 'Your stored photos could not be deleted. Nothing was changed.', {
        detail: String(cause),
      }),
    );
  }
}
