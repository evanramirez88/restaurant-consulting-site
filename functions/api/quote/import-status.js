/**
 * Quote Import Status Handler
 *
 * GET /api/quote/import-status?jobId=xxx
 *
 * Returns the status of a quote import job and extracted items when complete.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing jobId parameter'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Database not configured'
      }), {
        status: 503,
        headers: corsHeaders
      });
    }

    // Get job from database
    const job = await env.DB.prepare(`
      SELECT
        id,
        status,
        file_name,
        extracted_items_json,
        error_message,
        processing_started_at,
        processing_completed_at,
        created_at,
        updated_at
      FROM quote_import_jobs
      WHERE id = ?
    `).bind(jobId).first();

    if (!job) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Parse extracted items if complete
    let extractedItems = [];
    if (job.status === 'completed' && job.extracted_items_json) {
      try {
        extractedItems = JSON.parse(job.extracted_items_json);
      } catch (e) {
        console.error('Failed to parse extracted items:', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      jobId: job.id,
      status: job.status,
      fileName: job.file_name,
      extractedItems: extractedItems,
      itemCount: extractedItems.length,
      error: job.error_message || null,
      timing: {
        createdAt: job.created_at,
        processingStartedAt: job.processing_started_at,
        processingCompletedAt: job.processing_completed_at
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Status check error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get job status'
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
