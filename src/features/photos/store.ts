import { Directory, File, Paths } from 'expo-file-system';

import { appError, err, ok, type Result } from '@/lib/result';

/**
 * Meal photos kept on the device.
 *
 * A photo taken in the scanner lands in the cache directory, which the system
 * may clear at any time. To show a meal's own photo in the journal later it
 * has to be copied somewhere durable, and that is all this module does.
 *
 * It is deliberately device-local. A file path means nothing on another
 * device, so these are never written to the database and never sync; a photo
 * belongs to the phone that took it. Attaching one at all is gated on the
 * "Keep my meal photos" preference, which promises during onboarding that
 * with it off "your journal keeps only the food names and numbers".
 */

const FOLDER = 'meal-photos';

/**
 * Ids are generated as UUIDs, but they also arrive from the database, so they
 * are checked rather than trusted before being used as a filename. Anything
 * with a dot or a slash in it could escape the folder.
 */
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Whether each entry has a photo, remembered between calls.
 *
 * Checking existence is a synchronous call into the native filesystem, and
 * the journal asks once per row. Without this a list of thirty meals hits
 * the disk thirty times on every scroll pass. Every write path below clears
 * the entry it touches, so the cache cannot go stale behind a change the app
 * itself made.
 */
const presenceCache = new Map<string, string | null>();

function photosDirectory(): Directory {
  return new Directory(Paths.document, FOLDER);
}

function fileFor(entryId: string): File {
  return new File(photosDirectory(), `${entryId}.jpg`);
}

/** Where this entry's photo would live, whether or not one is there. */
export function mealPhotoPath(entryId: string): string | null {
  if (!SAFE_ID.test(entryId)) return null;
  try {
    return fileFor(entryId).uri;
  } catch {
    return null;
  }
}

/** The entry's photo, or null when it has none. */
export function mealPhotoUri(entryId: string): string | null {
  if (!SAFE_ID.test(entryId)) return null;

  const cached = presenceCache.get(entryId);
  if (cached !== undefined) return cached;

  let resolved: string | null;
  try {
    const file = fileFor(entryId);
    resolved = file.exists ? file.uri : null;
  } catch {
    // A missing directory, a revoked permission, a corrupt path: all mean
    // "no photo to show", which is a state the journal renders properly.
    resolved = null;
  }

  presenceCache.set(entryId, resolved);
  return resolved;
}

/**
 * Copy a captured photo into durable storage, keyed by the entry it belongs
 * to. Overwrites any existing photo for that entry, so re-attaching works.
 */
export async function saveMealPhoto(
  entryId: string,
  sourceUri: string,
): Promise<Result<string>> {
  if (!SAFE_ID.test(entryId)) {
    return err(
      appError('validation', 'That meal could not be matched to a photo.', {
        detail: `Unsafe entry id: ${entryId}`,
        retryable: false,
      }),
    );
  }

  presenceCache.delete(entryId);

  try {
    const directory = photosDirectory();
    if (!directory.exists) directory.create({ intermediates: true });

    const destination = fileFor(entryId);
    if (destination.exists) destination.delete();

    await new File(sourceUri).copy(destination);
    presenceCache.set(entryId, destination.uri);
    return ok(destination.uri);
  } catch (cause) {
    return err(
      appError('unknown', 'The photo could not be saved with this meal.', {
        detail: cause instanceof Error ? cause.message : String(cause),
        retryable: true,
      }),
    );
  }
}

/**
 * Remove an entry's photo. Safe to call when there is none, which is what
 * makes it safe to call on every entry deletion.
 */
export function deleteMealPhoto(entryId: string): void {
  if (!SAFE_ID.test(entryId)) return;
  presenceCache.set(entryId, null);
  try {
    const file = fileFor(entryId);
    if (file.exists) file.delete();
  } catch {
    // Nothing useful to do, and failing to delete a photo must never stop an
    // entry from being deleted.
  }
}

/**
 * Delete every stored meal photo.
 *
 * Used when the user turns photo keeping off, and when they erase their data:
 * turning the setting off has to clear what was already kept, or the promise
 * it makes is only about the future.
 */
export function deleteAllMealPhotos(): void {
  presenceCache.clear();
  try {
    const directory = photosDirectory();
    if (directory.exists) directory.delete();
  } catch {
    // As above: best effort.
  }
}
