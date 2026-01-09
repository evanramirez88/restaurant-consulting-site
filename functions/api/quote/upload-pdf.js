/**
 * Quote Builder PDF Upload Handler
 *
 * POST /api/quote/upload-pdf
 *
 * Accepts Toast quote PDFs, stores in R2,
 * creates a quote import job record in D1 for processing.
 */

import { getCorsOrigin } from '../../_shared/auth.js';
import { rateLimit, RATE_LIMITS } from '../../_shared/rate-limit.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// Only allow PDF files for Toast quotes
const ALLOWED_TYPES = {
  'application/pdf': { ext: 'pdf', maxSize: 10 * 1024 * 1024 }  // 10MB
};

/**
 * Generate unique ID for job and file storage
 */
function generateId() {
  return `quote_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate file type and size
 */
function validateFile(contentType, size) {
  const typeConfig = ALLOWED_TYPES[contentType];
  if (!typeConfig) {
    return { valid: false, error: `Only PDF files are supported. Received: ${contentType}` };
  }
  if (size > typeConfig.maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${typeConfig.maxSize / (1024 * 1024)}MB`
    };
  }
  return { valid: true, ext: typeConfig.ext };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Rate limiting - 10 uploads per 5 minutes per IP
  const rateLimitResponse = await rateLimit(
    request,
    env.RATE_LIMIT_KV,
    'quote-upload',
    RATE_LIMITS.QUOTE_FORM,
    corsHeaders
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    // Demo mode when R2 bucket is not configured
    if (!env.R2_BUCKET) {
      console.warn('R2 not configured, using demo mode');
      const demoJobId = `demo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Store demo job in DB if available
      if (env.DB) {
        try {
          // Table should exist from migrations - just insert
          await env.DB.prepare(`
            INSERT INTO quote_import_jobs (id, status, file_key, file_name, file_type, file_size, created_at, updated_at)
            VALUES (?, 'uploaded', ?, ?, ?, ?, unixepoch(), unixepoch())
          `).bind(
            demoJobId,
            `demo/${demoJobId}.pdf`,
            file?.name || 'demo-quote.pdf',
            'application/pdf',
            file?.size || 0
          ).run();
        } catch (dbError) {
          console.error('Demo DB error:', dbError);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        jobId: demoJobId,
        fileKey: `demo/${demoJobId}.pdf`,
        message: '[Demo Mode] PDF upload simulated. Ready for processing.',
        demo: true,
        file: {
          name: file?.name || 'demo-quote.pdf',
          type: 'application/pdf',
          size: file?.size || 0
        }
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

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
    const fileKey = `quotes/${jobId}.${validation.ext}`;

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

    // Create job record in D1
    if (env.DB) {
      try {
        // Table exists from migration 0005_quote_import.sql
        await env.DB.prepare(`
          INSERT INTO quote_import_jobs (id, status, file_key, file_name, file_type, file_size, created_at, updated_at)
          VALUES (?, 'uploaded', ?, ?, ?, ?, unixepoch(), unixepoch())
        `).bind(
          jobId,
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
      message: 'PDF uploaded successfully. Ready for processing.',
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

export async function onRequestOptions(context) {
  const { request } = context;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
