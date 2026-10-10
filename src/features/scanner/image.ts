import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';

/**
 * Image preparation before upload.
 *
 * Runs on the device, for three reasons: a 12 MP phone photo is far larger than
 * a vision model needs, uploading it wastes the user's data, and validating the
 * type and size here fails fast with a clear message. The server validates
 * again, because a client check is never a security boundary.
 */

/** Formats a vision model can read and we are willing to accept. */
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Longest edge after resizing. Enough detail for food, small to upload. */
export const MAX_IMAGE_EDGE = 1280;

/** Reject anything larger before we even try to process it. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/** Upload ceiling after compression. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const JPEG_QUALITY = 0.72;

export interface PreparedImage {
  uri: string;
  mimeType: AllowedMimeType;
  width: number;
  height: number;
  byteSize: number;
}

export function isAllowedMimeType(value: string | null | undefined): value is AllowedMimeType {
  return typeof value === 'string' && (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Guess a MIME type from a file extension.
 *
 * Image pickers do not always report a type, and an extension is the only hint
 * available then. The server still checks the real bytes.
 */
export function mimeTypeFromUri(uri: string): string | null {
  const withoutQuery = uri.split('?')[0] ?? uri;
  const extension = withoutQuery.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      // Readable by the OS but not by most model APIs; we convert to JPEG.
      return 'image/heic';
    default:
      return null;
  }
}

/** Scale a size down so its longest edge is at most `maxEdge`. */
export function fitWithinMaxEdge(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Validate, resize and re-encode a picked image.
 *
 * Always outputs JPEG: it is universally accepted by vision APIs, and it also
 * converts iPhone HEIC photos, which many APIs reject.
 */
export async function prepareImageForUpload(
  sourceUri: string,
  reportedMimeType?: string | null,
): Promise<Result<PreparedImage>> {
  const mimeType = reportedMimeType ?? mimeTypeFromUri(sourceUri);

  // HEIC is allowed as INPUT because we re-encode it; other unknown types are not.
  if (mimeType !== null && !isAllowedMimeType(mimeType) && mimeType !== 'image/heic') {
    return err(
      appError(
        'unsupported_media',
        'That file is not a supported photo. Use a JPEG, PNG or WebP image.',
        { detail: `reported type: ${mimeType}`, retryable: false },
      ),
    );
  }

  try {
    const source = new File(sourceUri);
    if (!source.exists) {
      return err(
        appError('not_found', 'That photo could not be read. Try choosing it again.', {
          retryable: false,
        }),
      );
    }
    if (source.size !== null && source.size > MAX_SOURCE_BYTES) {
      return err(
        appError('unsupported_media', 'That photo is too large. Try one under 25 MB.', {
          detail: `source bytes: ${source.size}`,
          retryable: false,
        }),
      );
    }

    const context = ImageManipulator.manipulate(sourceUri);
    context.resize({ width: MAX_IMAGE_EDGE });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: JPEG_QUALITY,
    });

    const savedFile = new File(saved.uri);
    const byteSize = savedFile.exists ? (savedFile.size ?? 0) : 0;

    if (byteSize > MAX_UPLOAD_BYTES) {
      return err(
        appError(
          'unsupported_media',
          'That photo is still too large after compression. Try a different one.',
          { detail: `compressed bytes: ${byteSize}`, retryable: false },
        ),
      );
    }

    return ok({
      uri: saved.uri,
      mimeType: 'image/jpeg',
      width: saved.width,
      height: saved.height,
      byteSize,
    });
  } catch (cause) {
    logger.warn('image preparation failed', { cause: String(cause) });
    return err(
      appError('unknown', 'We could not process that photo. Try another one.', {
        detail: String(cause),
        retryable: true,
      }),
    );
  }
}

/** Removes a prepared temp file. Called once a photo is uploaded or discarded. */
export function discardPreparedImage(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (cause) {
    // A leftover file in the cache directory is harmless; the OS clears it.
    logger.debug('could not delete prepared image', { cause: String(cause) });
  }
}
