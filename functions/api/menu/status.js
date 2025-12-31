/**
 * Menu Job Status Handler
 *
 * GET /api/menu/status?jobId=xxx
 *
 * Returns the current status of a menu processing job.
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

    // Check if database is configured
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
      SELECT id, name, email, restaurant_name, status, file_name, file_type, file_size,
             parsed_menu_json, error_message, created_at, updated_at,
             processing_started_at, processing_completed_at
      FROM menu_jobs
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

    // Parse the menu JSON if available
    let parsedMenu = null;
    if (job.parsed_menu_json) {
      try {
        parsedMenu = JSON.parse(job.parsed_menu_json);
      } catch (e) {
        console.error('Failed to parse menu JSON:', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        file: {
          name: job.file_name,
          type: job.file_type,
          size: job.file_size
        },
        restaurantName: job.restaurant_name,
        parsedMenu,
        error: job.error_message,
        timestamps: {
          created: job.created_at,
          updated: job.updated_at,
          processingStarted: job.processing_started_at,
          processingCompleted: job.processing_completed_at
        }
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Status check error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to check job status'
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
