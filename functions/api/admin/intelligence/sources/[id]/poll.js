/**
 * Poll Feed Source API
 * POST /api/admin/intelligence/sources/[id]/poll - Manually trigger a poll for a specific source
 */

import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../../../../_shared/auth.js';

// RSS Parser (simple implementation)
async function parseRSS(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'R&G Intelligence Agent/1.0',
      'Accept': 'application/rss+xml, application/xml, text/xml'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  const items = [];

  // Simple RSS/Atom parser using regex (Workers don't have DOMParser)
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const titleRegex = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
  const linkRegex = /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i;
  const descRegex = /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i;
  const pubDateRegex = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i;
  const guidRegex = /<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i;
  const authorRegex = /<(?:author|dc:creator)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:author|dc:creator)>/i;

  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const itemXml = match[1];
    const titleMatch = titleRegex.exec(itemXml);
    const linkMatch = linkRegex.exec(itemXml);
    const descMatch = descRegex.exec(itemXml);
    const pubDateMatch = pubDateRegex.exec(itemXml);
    const guidMatch = guidRegex.exec(itemXml);
    const authorMatch = authorRegex.exec(itemXml);

    items.push({
      title: titleMatch ? titleMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '') : 'No Title',
      url: linkMatch ? linkMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '') : null,
      content: descMatch ? descMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '').substring(0, 2000) : null,
      published_at: pubDateMatch ? Math.floor(new Date(pubDateMatch[1].trim()).getTime() / 1000) : null,
      external_id: guidMatch ? guidMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '') : null,
      author: authorMatch ? authorMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '') : null
    });
  }

  return items;
}

// Reddit JSON Parser
async function parseReddit(url) {
  // Ensure .json suffix
  const jsonUrl = url.endsWith('.json') ? url : `${url.replace(/\/$/, '')}.json`;

  const response = await fetch(jsonUrl, {
    headers: {
      'User-Agent': 'R&G Intelligence Agent/1.0 (by /u/restaurant_tech)'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const items = [];

  const posts = data?.data?.children || [];
  for (const post of posts.slice(0, 25)) {
    const p = post.data;
    items.push({
      title: p.title,
      url: `https://reddit.com${p.permalink}`,
      content: p.selftext ? p.selftext.substring(0, 2000) : null,
      published_at: p.created_utc ? Math.floor(p.created_utc) : null,
      external_id: p.id,
      author: p.author,
      metadata: {
        score: p.score,
        num_comments: p.num_comments,
        subreddit: p.subreddit,
        flair: p.link_flair_text
      }
    });
  }

  return items;
}

export async function onRequestPost(context) {
  const { env, request, params } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const { id } = params;

    // Get source
    const source = await env.DB.prepare('SELECT * FROM intel_feed_sources WHERE id = ?').bind(id).first();
    if (!source) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source not found'
      }), {
        status: 404,
        headers: getCorsHeaders(request)
      });
    }

    let items = [];
    let errorMsg = null;

    try {
      // Parse based on source type
      if (source.source_type === 'rss') {
        items = await parseRSS(source.url);
      } else if (source.source_type === 'reddit') {
        items = await parseReddit(source.url);
      } else {
        throw new Error(`Unsupported source type: ${source.source_type}`);
      }
    } catch (fetchError) {
      errorMsg = fetchError.message;

      // Update error count
      await env.DB.prepare(`
        UPDATE intel_feed_sources
        SET last_polled_at = unixepoch(), error_count = error_count + 1, last_error = ?, updated_at = unixepoch()
        WHERE id = ?
      `).bind(errorMsg, id).run();

      return new Response(JSON.stringify({
        success: false,
        error: `Failed to fetch source: ${errorMsg}`,
        source_id: id
      }), {
        status: 502,
        headers: getCorsHeaders(request)
      });
    }

    // Insert new items (skip duplicates)
    let insertedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const externalId = item.external_id || item.url || `${source.id}_${item.title?.substring(0, 50)}`;

      // Check for existing item
      const existing = await env.DB.prepare(`
        SELECT id FROM intel_feed_items WHERE source_id = ? AND (external_id = ? OR url = ?)
      `).bind(id, externalId, item.url).first();

      if (existing) {
        skippedCount++;
        continue;
      }

      const itemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      await env.DB.prepare(`
        INSERT INTO intel_feed_items (id, source_id, external_id, title, content, url, author, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        itemId,
        id,
        externalId,
        item.title,
        item.content,
        item.url,
        item.author,
        item.published_at
      ).run();

      insertedCount++;
    }

    // Update source polling info
    const latestItemAt = items.length > 0
      ? Math.max(...items.map(i => i.published_at || 0))
      : null;

    await env.DB.prepare(`
      UPDATE intel_feed_sources
      SET last_polled_at = unixepoch(), error_count = 0, last_error = NULL, last_item_at = COALESCE(?, last_item_at), updated_at = unixepoch()
      WHERE id = ?
    `).bind(latestItemAt, id).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Polled ${source.name}`,
      data: {
        source_id: id,
        source_name: source.name,
        items_found: items.length,
        items_inserted: insertedCount,
        items_skipped: skippedCount
      }
    }), {
      status: 200,
      headers: getCorsHeaders(request)
    });

  } catch (error) {
    console.error('Poll error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to poll source'
    }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
