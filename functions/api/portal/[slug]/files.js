/**
 * Portal Files API
 *
 * GET /api/portal/[slug]/files
 *
 * Returns files for the authenticated client.
 * Supports Google Drive integration placeholders.
 * Requires client authentication.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

const COOKIE_NAME = 'ccrc_client_token';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

/**
 * Parse cookies from request
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=').trim();
    if (name) {
      cookies[name.trim()] = value;
    }
  });

  return cookies;
}

/**
 * Verify client authentication and return client ID
 */
async function verifyClientAuth(request, env, slug) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];

  if (!token) {
    return { authenticated: false, error: 'No session' };
  }

  const jwtSecret = env.CLIENT_JWT_SECRET || env.JWT_SECRET;
  if (!jwtSecret) {
    return { authenticated: false, error: 'Server config error' };
  }

  try {
    const isValid = await jwt.verify(token, jwtSecret);
    if (!isValid) {
      return { authenticated: false, error: 'Invalid session' };
    }

    const { payload } = jwt.decode(token);

    // Verify the client matches the slug
    const db = env.DB;
    const client = await db.prepare('SELECT id, slug, google_drive_folder_id FROM clients WHERE id = ?')
      .bind(payload.clientId)
      .first();

    if (!client || client.slug !== slug) {
      return { authenticated: false, error: 'Unauthorized' };
    }

    return {
      authenticated: true,
      clientId: payload.clientId,
      googleDriveFolderId: client.google_drive_folder_id
    };
  } catch (error) {
    return { authenticated: false, error: 'Session error' };
  }
}

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const { slug } = params;

  if (!slug) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing client slug'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // Verify authentication
  const auth = await verifyClientAuth(request, env, slug);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({
      success: false,
      error: auth.error || 'Unauthorized'
    }), {
      status: 401,
      headers: corsHeaders
    });
  }

  try {
    const db = env.DB;

    // Get files uploaded for this client
    const { results } = await db.prepare(`
      SELECT
        id,
        file_name as name,
        file_type as type,
        file_size as size,
        storage_key,
        storage_provider,
        google_drive_file_id,
        description,
        tags_json,
        created_at,
        updated_at
      FROM file_uploads
      WHERE client_id = ?
      ORDER BY created_at DESC
    `).bind(auth.clientId).all();

    // Transform file data
    const files = (results || []).map(file => {
      // Parse tags
      let tags = [];
      try {
        if (file.tags_json) {
          tags = JSON.parse(file.tags_json);
        }
      } catch (e) {
        tags = [];
      }

      // Determine category from tags or default
      const categoryTags = ['training', 'sops', 'contracts', 'invoices'];
      const category = tags.find(t => categoryTags.includes(t.toLowerCase())) || 'other';

      // Build file URL (would use R2 signed URLs in production)
      let url = '';
      if (file.storage_provider === 'r2' && env.R2_BUCKET_URL) {
        url = `${env.R2_BUCKET_URL}/${file.storage_key}`;
      } else if (file.google_drive_file_id) {
        url = `https://drive.google.com/file/d/${file.google_drive_file_id}/view`;
      }

      return {
        id: file.id,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size || 0,
        category: category.toLowerCase(),
        description: file.description,
        url: url,
        google_drive_file_id: file.google_drive_file_id,
        created_at: file.created_at,
        updated_at: file.updated_at
      };
    });

    return new Response(JSON.stringify({
      success: true,
      data: files,
      googleDriveIntegrated: Boolean(auth.googleDriveFolderId)
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Portal files error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to load files'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
