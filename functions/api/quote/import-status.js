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

    // Demo mode when DB is not configured
    if (!env.DB) {
      console.warn('DB not configured, using demo mode for status');
      const demoItems = [
        {
          id: 'demo_1',
          productName: 'Toast Flex, Toast Tap (Direct Attach), Toast Printer, Cash Drawer',
          quantity: 2,
          mappedHardwareIds: ['toast-flex', 'card-reader-direct', 'receipt-printer', 'cash-drawer'],
          confidence: 0.95
        },
        {
          id: 'demo_2',
          productName: 'Toast Go 2, Charging Dock',
          quantity: 3,
          mappedHardwareIds: ['toast-go2', 'charging-dock'],
          confidence: 0.95
        },
        {
          id: 'demo_3',
          productName: 'Kitchen Display (Elo V4)',
          quantity: 1,
          mappedHardwareIds: ['toast-kds'],
          confidence: 0.95
        },
        {
          id: 'demo_4',
          productName: 'Impact Printer',
          quantity: 2,
          mappedHardwareIds: ['impact-printer'],
          confidence: 0.95
        },
        {
          id: 'demo_5',
          productName: 'Meraki Router',
          quantity: 1,
          mappedHardwareIds: ['router'],
          confidence: 0.95
        },
        {
          id: 'demo_6',
          productName: 'PoE Switch (TP-Link)',
          quantity: 1,
          mappedHardwareIds: ['poe-switch'],
          confidence: 0.95
        }
      ];

      return new Response(JSON.stringify({
        success: true,
        jobId,
        status: 'completed',
        fileName: 'demo-quote.pdf',
        extractedItems: demoItems,
        itemCount: demoItems.length,
        demo: true,
        timing: {
          createdAt: Date.now(),
          processingStartedAt: Date.now(),
          processingCompletedAt: Date.now()
        }
      }), {
        status: 200,
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
