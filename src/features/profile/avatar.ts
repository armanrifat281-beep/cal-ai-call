import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { create } from 'zustand';

import { prepareImageForUpload } from '@/features/scanner/image';
import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * The user's profile picture.
 *
 * Kept in two places on purpose. The device holds the picture itself, so it
 * draws instantly, survives being offline, and costs nothing to show on three
 * screens at once. Supabase Storage holds a copy so it survives reinstalling
 * the app or signing in on another phone - which is the whole reason the
 * `profiles.avatar_url` column exists.
 *
 * The device copy is the one the UI reads. The remote copy is only consulted
 * when there is no local file, which is exactly the reinstall case.
 */

const BUCKET = 'avatars';
const FOLDER = 'profile';
const FILENAME = 'avatar.jpg';
/** Long enough that a signed URL outlives any single download. */
const SIGNED_URL_TTL_SECONDS = 60 * 10;

function avatarDirectory(): Directory {
  return new Directory(Paths.document, FOLDER);
}

function avatarFile(): File {
  return new File(avatarDirectory(), FILENAME);
}

interface AvatarState {
  /**
   * A `file://` uri, or null for none.
   *
   * Carries a `?v=` counter because the filename never changes: without it
   * React Native's image cache keeps showing the previous picture after a
   * change, which looks exactly like the upload having failed.
   */
  uri: string | null;
  setUri: (uri: string | null) => void;
}

let version = 0;

export const useAvatarStore = create<AvatarState>((set) => ({
  uri: null,
  setUri: (uri) => set({ uri }),
}));

/** The local file's uri with a fresh cache-buster, or null if absent. */
function localUri(): string | null {
  const file = avatarFile();
  if (!file.exists) return null;
  version += 1;
  return `${file.uri}?v=${version}`;
}

/** Point the store at whatever is on disk. Safe to call repeatedly. */
export function refreshAvatar(): void {
  useAvatarStore.getState().setUri(localUri());
}

function storagePathFor(userId: string): string {
  return `${userId}/${FILENAME}`;
}

/**
 * Ask for a picture and store it.
 *
 * Cancelling is not a failure: it returns ok with `changed: false` so the
 * caller does not show an error for someone who simply changed their mind.
 */
export async function pickAvatar(
  source: 'camera' | 'library',
): Promise<Result<{ changed: boolean }>> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    // No camera access is a reason to offer the library, not an error.
    if (!permission.granted) return pickAvatar('library');
  }

  const picked =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          exif: false,
          allowsEditing: true,
          aspect: [1, 1],
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          exif: false,
          allowsEditing: true,
          aspect: [1, 1],
        });

  if (picked.canceled) return ok({ changed: false });
  const asset = picked.assets[0];
  if (!asset) return ok({ changed: false });

  const prepared = await prepareImageForUpload(asset.uri, asset.mimeType);
  if (!prepared.ok) return prepared;

  const saved = await saveLocally(prepared.value.uri);
  if (!saved.ok) return saved;

  // The picture is already on screen by now. A failed upload means it will
  // not follow the user to another device, which is worth saying, but it is
  // not worth throwing away a picture that is sitting on disk and working.
  const uploaded = await uploadAvatar();
  if (!uploaded.ok) {
    logger.warn('avatar uploaded no further than this device', {
      cause: uploaded.error.message,
    });
  }

  return ok({ changed: true });
}

/** Copy the prepared image into the durable folder and show it. */
async function saveLocally(sourceUri: string): Promise<Result<void>> {
  try {
    const directory = avatarDirectory();
    if (!directory.exists) directory.create({ intermediates: true });

    const destination = avatarFile();
    if (destination.exists) destination.delete();
    new File(sourceUri).copy(destination);

    refreshAvatar();
    return ok(undefined);
  } catch (cause) {
    logger.warn('avatar could not be saved to the device', { cause: String(cause) });
    return err(
      appError('unknown', 'That picture could not be saved. Try another one.', {
        detail: String(cause),
      }),
    );
  }
}

/** Push the device's copy to storage and record its path on the profile. */
async function uploadAvatar(): Promise<Result<void>> {
  const client = getSupabaseClient();
  if (!client) return ok(undefined); // No account in this build; local is all there is.

  try {
    const { data: auth } = await client.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return ok(undefined);

    const file = avatarFile();
    if (!file.exists) return ok(undefined);

    const path = storagePathFor(userId);
    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(path, file.bytes(), { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;

    const { error: profileError } = await client
      .from('profiles')
      .update({ avatar_url: path })
      .eq('id', userId);
    if (profileError) throw profileError;

    return ok(undefined);
  } catch (cause) {
    return err(
      appError('network', 'Your picture is saved on this phone but not synced yet.', {
        detail: String(cause),
      }),
    );
  }
}

/**
 * Fetch the stored picture when this device has none.
 *
 * Called after sign-in. Does nothing when a local file already exists, so a
 * picture chosen on this phone is never overwritten by an older one.
 */
export async function restoreAvatar(): Promise<void> {
  if (avatarFile().exists) {
    refreshAvatar();
    return;
  }

  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data: auth } = await client.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    const { data: profile } = await client
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();

    const path = profile?.avatar_url;
    if (!path) return;

    const { data: signed } = await client.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (!signed?.signedUrl) return;

    const directory = avatarDirectory();
    if (!directory.exists) directory.create({ intermediates: true });
    await File.downloadFileAsync(signed.signedUrl, avatarFile());

    refreshAvatar();
  } catch (cause) {
    // A missing picture is not worth interrupting anyone over.
    logger.warn('avatar could not be restored', { cause: String(cause) });
  }
}

/** Remove it from the device and from storage. */
export async function removeAvatar(): Promise<Result<void>> {
  try {
    const file = avatarFile();
    if (file.exists) file.delete();
    refreshAvatar();
  } catch (cause) {
    logger.warn('avatar could not be deleted from the device', { cause: String(cause) });
  }

  const client = getSupabaseClient();
  if (!client) return ok(undefined);

  try {
    const { data: auth } = await client.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return ok(undefined);

    await client.storage.from(BUCKET).remove([storagePathFor(userId)]);
    await client.from('profiles').update({ avatar_url: null }).eq('id', userId);
    return ok(undefined);
  } catch (cause) {
    return err(
      appError('network', 'Removed here, but the stored copy could not be reached.', {
        detail: String(cause),
      }),
    );
  }
}

/** Erase the device's copy without touching storage. For sign-out. */
export function forgetAvatarLocally(): void {
  try {
    const file = avatarFile();
    if (file.exists) file.delete();
  } catch (cause) {
    logger.warn('avatar could not be cleared on sign out', { cause: String(cause) });
  }
  useAvatarStore.getState().setUri(null);
}
