/**
 * Menu Builder File Upload Handler
 *
 * POST /api/menu/upload
 *
 * Accepts menu files (PDF, PNG, JPG, HEIC), stores in R2,
 * creates a menu job record in D1 for processing.
 *
 * AUTHENTICATION: Requires admin or client JWT authentication
 */

import { verifyAuth, verifyClientAuth, unauthorizedResponse, handleOptions } from '../../_shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Allowed file types
const ALLOWED_TYPES = {
  'application/pdf': { ext: 'pdf', maxSize: 10 * 1024 * 1024 },      // 10MB
  'image/jpeg': { ext: 'jpg', maxSize: 5 * 1024 * 1024 },             // 5MB
  'image/png': { ext: 'png', maxSize: 5 * 1024 * 1024 },              // 5MB
  'image/heic': { ext: 'heic', maxSize: 10 * 1024 * 1024 },           // 10MB
  'image/webp': { ext: 'webp', maxSize: 5 * 1024 * 1024 }             // 5MB
};

/**
 * Generate unique ID for job and file storage
 */
function generateId() {
  return `menu_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate file type and size
 */
function validateFile(contentType, size) {
  const typeConfig = ALLOWED_TYPES[contentType];
  if (!typeConfig) {
    return { valid: false, error: `Unsupported file type: ${contentType}` };
  }
  if (size > typeConfig.maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size for ${typeConfig.ext.toUpperCase()} is ${typeConfig.maxSize / (1024 * 1024)}MB`
    };
  }
  return { valid: true, ext: typeConfig.ext };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Verify authentication - require either admin or client session
    const adminAuth = await verifyAuth(request, env);
    let authenticatedUser = null;

    if (adminAuth.authenticated) {
      authenticatedUser = { type: 'admin', payload: adminAuth.payload };
    } else {
      // Try client authentication
      const clientAuth = await verifyClientAuth(request, env);
      if (clientAuth.authenticated) {
        authenticatedUser = { type: 'client', clientId: clientAuth.clientId, payload: clientAuth.payload };
      }
    }

    if (!authenticatedUser) {
      return unauthorizedResponse('Authentication required to upload menu files');
    }

    // Check if R2 bucket is configured
    if (!env.R2_BUCKET) {
      return new Response(JSON.stringify({
        success: false,
        error: 'File storage not configured'
      }), {
        status: 503,
        headers: corsHeaders
      });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');
    const name = formData.get('name') || 'Anonymous';
    const email = formData.get('email') || '';
    const restaurantName = formData.get('restaurantName') || '';

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No file provided'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate file
    const validation = validateFile(file.type, file.size);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: validation.error
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Generate job ID and file key
    const jobId = generateId();
    const fileKey = `menus/${jobId}.${validation.ext}`;

    // Upload to R2
    const fileBuffer = await file.arrayBuffer();
    await env.R2_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: {
        contentType: file.type
      },
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        jobId: jobId
      }
    });

    // Create job record in D1 (if database is configured)
    if (env.DB) {
      try {
        await env.DB.prepare(`
          INSERT INTO menu_jobs (id, name, email, restaurant_name, status, file_key, file_name, file_type, file_size, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'uploaded', ?, ?, ?, ?, unixepoch(), unixepoch())
        `).bind(
          jobId,
          name,
          email,
          restaurantName,
          fileKey,
          file.name,
          file.type,
          file.size
        ).run();
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Continue even if DB fails - file is already uploaded
      }
    }

    return new Response(JSON.stringify({
      success: true,
      jobId,
      fileKey,
      message: 'File uploaded successfully. Ready for processing.',
      file: {
        name: file.name,
        type: file.type,
        size: file.size
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to upload file'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
