import { Directory, File, Paths } from 'expo-file-system';

import { appError, err, ok, type Result } from '@/lib/result';

/**
 * Photos the user took, kept on the device.
 *
 * A photo taken in the scanner lands in the cache directory, which the system
 * may clear at any time. To show it again later it has to be copied somewhere
 * durable, and that is all this module does.
 *
 * It is deliberately device-local. A file path means nothing on another
 * device, so these are never written to the database and never sync; a photo
 * belongs to the phone that took it.
 *
 * There are two collections, kept apart because they are governed
 * differently. A `meal` photo is attached to a journal entry and is gated on
 * the "Keep my meal photos" preference, which promises during onboarding
 * that with it off "your journal keeps only the food names and numbers". A
 * `dish` photo is one the user deliberately took of something they cooked
 * and attached to their own recipe - an explicit act each time, not an
 * automatic consequence of scanning - so it is not covered by that promise
 * and is not governed by that setting. Erasing everything clears both.
 */

export type PhotoCollection = 'meal' | 'dish';

const FOLDERS: Record<PhotoCollection, string> = {
  meal: 'meal-photos',
  dish: 'dish-photos',
};

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

function photosDirectory(collection: PhotoCollection): Directory {
  return new Directory(Paths.document, FOLDERS[collection]);
}

function fileFor(collection: PhotoCollection, id: string): File {
  return new File(photosDirectory(collection), `${id}.jpg`);
}

function cacheKey(collection: PhotoCollection, id: string): string {
  return `${collection}:${id}`;
}

/** The stored photo, or null when there is none. */
export function photoUri(collection: PhotoCollection, id: string): string | null {
  if (!SAFE_ID.test(id)) return null;

  const key = cacheKey(collection, id);
  const cached = presenceCache.get(key);
  if (cached !== undefined) return cached;

  let resolved: string | null;
  try {
    const file = fileFor(collection, id);
    resolved = file.exists ? file.uri : null;
  } catch {
    // A missing directory, a revoked permission, a corrupt path: all mean
    // "no photo to show", which is a state the screen renders properly.
    resolved = null;
  }

  presenceCache.set(key, resolved);
  return resolved;
}

/**
 * Copy a captured photo into durable storage, keyed by the entry it belongs
 * to. Overwrites any existing photo for that entry, so re-attaching works.
 */
export async function savePhoto(
  collection: PhotoCollection,
  id: string,
  sourceUri: string,
): Promise<Result<string>> {
  if (!SAFE_ID.test(id)) {
    return err(
      appError('validation', 'That could not be matched to a photo.', {
        detail: `Unsafe id: ${id}`,
        retryable: false,
      }),
    );
  }

  presenceCache.delete(cacheKey(collection, id));

  try {
    const directory = photosDirectory(collection);
    if (!directory.exists) directory.create({ intermediates: true });

    const destination = fileFor(collection, id);
    if (destination.exists) destination.delete();

    await new File(sourceUri).copy(destination);
    presenceCache.set(cacheKey(collection, id), destination.uri);
    return ok(destination.uri);
  } catch (cause) {
    return err(
      appError('unknown', 'The photo could not be saved.', {
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
export function deletePhoto(collection: PhotoCollection, id: string): void {
  if (!SAFE_ID.test(id)) return;
  presenceCache.set(cacheKey(collection, id), null);
  try {
    const file = fileFor(collection, id);
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
export function deleteAllPhotos(collection?: PhotoCollection): void {
  presenceCache.clear();
  const collections: PhotoCollection[] = collection ? [collection] : ['meal', 'dish'];
  try {
    for (const name of collections) {
      const directory = photosDirectory(name);
      if (directory.exists) directory.delete();
    }
  } catch {
    // As above: best effort.
  }
}

// ---------------------------------------------------------------------------
// Named wrappers
// ---------------------------------------------------------------------------
//
// Call sites read better naming what they hold than passing a collection
// string, and the two collections are governed by different rules, so the
// distinction is worth keeping visible.

/** A photo of a logged meal. Governed by "Keep my meal photos". */
export const mealPhotoUri = (entryId: string) => photoUri('meal', entryId);
export const saveMealPhoto = (entryId: string, sourceUri: string) =>
  savePhoto('meal', entryId, sourceUri);
export const deleteMealPhoto = (entryId: string) => deletePhoto('meal', entryId);
export const deleteAllMealPhotos = () => deleteAllPhotos('meal');

/** A photo the user took of a dish they cooked, on their own recipe. */
export const dishPhotoUri = (recipeId: string) => photoUri('dish', recipeId);
export const saveDishPhoto = (recipeId: string, sourceUri: string) =>
  savePhoto('dish', recipeId, sourceUri);
export const deleteDishPhoto = (recipeId: string) => deletePhoto('dish', recipeId);
