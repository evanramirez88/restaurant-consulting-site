/**
 * Beacon Content Fetch Trigger
 *
 * POST /api/admin/beacon/fetch - Manually trigger content fetch from sources
 * GET /api/admin/beacon/fetch - Get last fetch status
 *
 * Fetches content from Reddit r/ToastPOS and other configured sources
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

// Reddit API base URL (no auth needed for public subreddits)
const REDDIT_BASE = 'https://www.reddit.com';

/**
 * Generate a content hash for deduplication
 */
function generateContentHash(title, body) {
  const content = `${title}|${body || ''}`.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Fetch posts from Reddit
 */
async function fetchRedditPosts(config) {
  const { subreddit, sort = 'new', limit = 25 } = config;

  const url = `${REDDIT_BASE}/r/${subreddit}/${sort}.json?limit=${limit}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BeaconContentAggregator/1.0 (by R&G Consulting)'
    }
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status}`);
  }

  const data = await response.json();

  return data.data.children.map(child => {
    const post = child.data;
    return {
      external_id: post.id,
      title: post.title,
      body: post.selftext || null,
      body_html: post.selftext_html || null,
      url: `https://reddit.com${post.permalink}`,
      author: post.author,
      source_url: `https://reddit.com/r/${subreddit}`,
      source_metadata_json: JSON.stringify({
        score: post.score,
        upvote_ratio: post.upvote_ratio,
        num_comments: post.num_comments,
        created_utc: post.created_utc,
        flair: post.link_flair_text,
        is_self: post.is_self,
        domain: post.domain
      }),
      source_created_at: Math.floor(post.created_utc)
    };
  });
}

/**
 * AI categorization using Workers AI (simplified)
 * In production, this would use the AI binding for more sophisticated analysis
 */
function categorizeContent(title, body) {
  const text = `${title} ${body || ''}`.toLowerCase();

  // Category detection
  let category = 'general';
  if (/menu|item|modifier|price|pricing|button/i.test(text)) {
    category = 'menu';
  } else if (/kds|printer|terminal|hardware|device|screen|display/i.test(text)) {
    category = 'hardware';
  } else if (/integrat|api|third.?party|connect|sync|doordash|uber|grubhub/i.test(text)) {
    category = 'integrations';
  } else if (/report|analytic|sales|data|export|csv/i.test(text)) {
    category = 'reports';
  } else if (/labor|schedule|employee|payroll|tip|clock/i.test(text)) {
    category = 'labor';
  } else if (/train|learn|how.?to|help|new/i.test(text)) {
    category = 'training';
  }

  // Sentiment detection
  let sentiment = 'neutral';
  if (/frustrat|broken|terrible|awful|hate|worst|angry|furious/i.test(text)) {
    sentiment = 'frustrated';
  } else if (/confus|unclear|don'?t understand|what does|how do|help/i.test(text)) {
    sentiment = 'confused';
  } else if (/love|great|amazing|awesome|perfect|thank/i.test(text)) {
    sentiment = 'positive';
  } else if (/issue|problem|error|bug|broken|fail|wrong|not work/i.test(text)) {
    sentiment = 'negative';
  }

  // Action suggestion
  let action = 'ignore';
  if (/help|how|question|\?$/i.test(text)) {
    action = 'solve';
  } else if (/issue|problem|error|bug/i.test(text)) {
    action = 'respond';
  } else if (/tip|guide|best practice|workflow/i.test(text)) {
    action = 'blog';
  } else if (/step|process|procedure/i.test(text)) {
    action = 'sop';
  }

  // Priority score (0-100)
  let priority = 50;
  if (sentiment === 'frustrated') priority += 20;
  if (sentiment === 'confused') priority += 15;
  if (action === 'solve') priority += 15;
  if (action === 'respond') priority += 10;
  if (/urgent|asap|emergency|need help now/i.test(text)) priority += 20;
  priority = Math.min(100, priority);

  return {
    ai_category: category,
    ai_sentiment: sentiment,
    ai_action_suggestion: action,
    ai_priority_score: priority
  };
}

/**
 * POST - Trigger content fetch from all enabled sources
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json().catch(() => ({}));
    const { source_id } = body; // Optional: fetch from specific source only

    // Get enabled sources
    let sourcesQuery = 'SELECT * FROM beacon_sources WHERE enabled = 1';
    const params = [];

    if (source_id) {
      sourcesQuery += ' AND id = ?';
      params.push(source_id);
    }

    const sourcesResult = await env.DB.prepare(sourcesQuery).bind(...params).all();
    const sources = sourcesResult.results || [];

    if (sources.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No enabled sources found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const results = [];

    for (const source of sources) {
      try {
        const config = JSON.parse(source.config_json || '{}');
        let posts = [];

        if (source.type === 'reddit') {
          posts = await fetchRedditPosts(config);
        }
        // Add more source types here in the future

        let inserted = 0;
        let skipped = 0;

        for (const post of posts) {
          // Check for duplicates by external_id
          const existing = await env.DB.prepare(
            'SELECT id FROM beacon_content_items WHERE external_id = ? AND source_id = ?'
          ).bind(post.external_id, source.id).first();

          if (existing) {
            skipped++;
            continue;
          }

          // Generate content hash for additional dedup
          const contentHash = generateContentHash(post.title, post.body);

          // AI categorization
          const aiAnalysis = categorizeContent(post.title, post.body);

          // Insert new content item
          const itemId = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

          await env.DB.prepare(`
            INSERT INTO beacon_content_items (
              id, source_id, external_id, title, body, body_html, url, author,
              source_type, source_url, source_metadata_json, content_hash,
              ai_category, ai_sentiment, ai_action_suggestion, ai_priority_score,
              source_created_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
          `).bind(
            itemId,
            source.id,
            post.external_id,
            post.title,
            post.body,
            post.body_html,
            post.url,
            post.author,
            source.type,
            post.source_url,
            post.source_metadata_json,
            contentHash,
            aiAnalysis.ai_category,
            aiAnalysis.ai_sentiment,
            aiAnalysis.ai_action_suggestion,
            aiAnalysis.ai_priority_score,
            post.source_created_at
          ).run();

          inserted++;
        }

        // Update source metadata
        await env.DB.prepare(`
          UPDATE beacon_sources
          SET last_fetched_at = unixepoch(),
              items_fetched_total = items_fetched_total + ?,
              error_count = 0,
              last_error = NULL,
              updated_at = unixepoch()
          WHERE id = ?
        `).bind(inserted, source.id).run();

        results.push({
          source_id: source.id,
          source_name: source.name,
          source_type: source.type,
          fetched: posts.length,
          inserted,
          skipped,
          status: 'success'
        });

      } catch (sourceError) {
        // Update source with error
        await env.DB.prepare(`
          UPDATE beacon_sources
          SET error_count = error_count + 1,
              last_error = ?,
              updated_at = unixepoch()
          WHERE id = ?
        `).bind(sourceError.message, source.id).run();

        results.push({
          source_id: source.id,
          source_name: source.name,
          source_type: source.type,
          status: 'error',
          error: sourceError.message
        });
      }
    }

    const totalInserted = results.reduce((sum, r) => sum + (r.inserted || 0), 0);
    const totalSkipped = results.reduce((sum, r) => sum + (r.skipped || 0), 0);

    return new Response(JSON.stringify({
      success: true,
      message: `Fetch complete: ${totalInserted} new items, ${totalSkipped} duplicates skipped`,
      data: {
        sources_processed: results.length,
        total_inserted: totalInserted,
        total_skipped: totalSkipped,
        results
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Beacon fetch error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fetch content'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * GET - Get fetch status and statistics
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get sources with last fetch info
    const sourcesResult = await env.DB.prepare(`
      SELECT
        id, name, type, enabled,
        fetch_frequency_minutes,
        last_fetched_at,
        items_fetched_total,
        error_count,
        last_error
      FROM beacon_sources
      ORDER BY enabled DESC, name ASC
    `).all();

    // Get recent fetch activity
    const recentItems = await env.DB.prepare(`
      SELECT
        s.name as source_name,
        COUNT(*) as count,
        MAX(i.fetched_at) as last_item_at
      FROM beacon_content_items i
      JOIN beacon_sources s ON i.source_id = s.id
      WHERE i.fetched_at > unixepoch() - 86400
      GROUP BY s.id
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        sources: sourcesResult.results || [],
        recent_activity: recentItems.results || []
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Beacon fetch status error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to get fetch status'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
