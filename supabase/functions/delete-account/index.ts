/**
 * delete-account - permanently deletes the caller's account and their data.
 *
 * A client cannot delete its own auth user: that requires the service role.
 * So this function verifies the caller from their own access token, then
 * deletes exactly that user. The user id comes from the verified token and
 * never from the request body, so a caller cannot ask for someone else.
 *
 * Deleting the auth user cascades to every table that references it
 * (`on delete cascade`), which covers profiles, preferences, journal entries
 * and their items, saved meals, recipes, shopping lists, insights, scan
 * history and entitlements. Stored photos are not rows, so they are removed
 * explicitly first.
 *
 * Deploy with:
 *   supabase functions deploy delete-account
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

const PHOTO_BUCKET = 'meal-photos';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Deletes every object in the user's photo folder.
 *
 * Storage objects are not database rows, so no cascade reaches them. Listing
 * is paged because a long-standing account can hold more than one page.
 */
async function deleteUserPhotos(
  admin: SupabaseClient,
  userId: string,
): Promise<{ deleted: number; failed: boolean }> {
  let deleted = 0;
  let failed = false;
  const pageSize = 100;
  // Each pass removes what it listed, so the next page is always at the top.
  // The bound stops a listing that never shrinks from looping forever.
  const maxPasses = 200;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const { data, error } = await admin.storage
      .from(PHOTO_BUCKET)
      .list(userId, { limit: pageSize });

    if (error) {
      console.error('delete-account: could not list photos', error.message);
      return { deleted, failed: true };
    }
    if (!data || data.length === 0) break;

    const paths = data.map((file) => `${userId}/${file.name}`);
    const { error: removeError } = await admin.storage
      .from(PHOTO_BUCKET)
      .remove(paths);

    if (removeError) {
      console.error('delete-account: could not remove photos', removeError.message);
      // Stop rather than retry the same page forever.
      return { deleted, failed: true };
    }

    deleted += paths.length;
    if (data.length < pageSize) break;
  }

  return { deleted, failed };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return jsonResponse(
      { error: { code: 'method_not_allowed', message: 'Use POST.' } },
      405,
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('delete-account: missing required secrets');
    return jsonResponse(
      {
        error: {
          code: 'not_configured',
          message: 'Account deletion is not available right now.',
        },
      },
      503,
    );
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(
      { error: { code: 'unauthorized', message: 'Sign in to delete your account.' } },
      401,
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The ONLY source of the user id. Taking it from the body would let any
  // signed-in caller delete any account.
  const { data: userData, error: userError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  const user = userData?.user;
  if (userError || !user) {
    return jsonResponse(
      { error: { code: 'unauthorized', message: 'Your session has expired.' } },
      401,
    );
  }

  // Photos first: once the auth user is gone we no longer know which folder
  // was theirs, and the objects would be orphaned in the bucket forever.
  const photos = await deleteUserPhotos(admin, user.id);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('delete-account: user deletion failed', deleteError.message);
    return jsonResponse(
      {
        error: {
          code: 'internal',
          message: 'We could not delete your account. Please try again.',
        },
      },
      500,
    );
  }

  console.log('delete-account: deleted user', {
    photosDeleted: photos.deleted,
    photoCleanupFailed: photos.failed,
  });

  return jsonResponse(
    {
      deleted: true,
      // Reported so a failed photo cleanup is visible rather than silent. The
      // account itself is gone either way.
      photosDeleted: photos.deleted,
      photoCleanupIncomplete: photos.failed,
    },
    200,
  );
});
