import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';

import { toProductLabel, type OffResponse } from './mapper';
import type { LabelLookup } from './types';

/**
 * Barcode lookup against Open Food Facts.
 *
 * Called from the device rather than through an Edge Function, which is the
 * opposite of how this app treats its other integrations - and deliberate.
 * The other two carry secrets: the Anthropic and Gemini keys exist only on
 * the server, and USDA is proxied because its key would otherwise ship in
 * the app. Open Food Facts needs no key at all, so a function in front of it
 * would add a hop, a cold start and a failure mode while protecting nothing.
 *
 * The fields are requested by name. The full record is large and mostly
 * irrelevant - images, packaging codes, a dozen scoring systems - and asking
 * for what is used keeps a scan quick on a phone connection.
 */
const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';

const FIELDS = [
  'product_name',
  'brands',
  'serving_size',
  'serving_quantity',
  'nutriments',
  'ingredients_text',
  'allergens_tags',
  'last_modified_t',
].join(',');

const TIMEOUT_MS = 12_000;

/**
 * Identifies this app to the service, which their terms ask for.
 *
 * It names the app and nothing about the user: a barcode scan should not
 * carry an identity to a third party.
 */
const USER_AGENT = 'FoodLensAI/1.0 (nutrition journal)';

/** Barcodes are 8-14 digits. Anything else never reaches the network. */
export function isPlausibleBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value.trim());
}

export async function lookupBarcode(
  barcode: string,
): Promise<Result<LabelLookup>> {
  const code = barcode.trim();

  if (!isPlausibleBarcode(code)) {
    return err(
      appError('validation', 'That does not look like a product barcode.', {
        retryable: false,
      }),
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(code)}?fields=${FIELDS}`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      },
    );

    // 404 is the database's honest answer for a product it does not hold,
    // which is a normal outcome of scanning, not a fault.
    if (response.status === 404) return err(notFound(code));

    if (!response.ok) {
      return err(
        appError('provider_error', 'The product database is not answering. Try again.', {
          detail: `HTTP ${response.status}`,
        }),
      );
    }

    const body = (await response.json()) as OffResponse;
    const lookup = toProductLabel(code, body);

    // A record with no name and no nutrition is a database stub. Showing it
    // as a successful scan would be worse than saying it was not found.
    if (lookup === null) return err(notFound(code));

    return ok(lookup);
  } catch (cause) {
    logger.warn('barcode lookup failed', { cause: String(cause) });
    return err(
      appError('network', 'We could not reach the product database.', {
        detail: String(cause),
      }),
    );
  } finally {
    clearTimeout(timeout);
  }
}

function notFound(code: string) {
  return appError(
    'not_found',
    'That product is not in the open database yet. You can still add it by hand.',
    { detail: `barcode ${code}`, retryable: false },
  );
}
