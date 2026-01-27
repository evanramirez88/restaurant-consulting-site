/**
 * Toast Hub Aggregator Worker
 *
 * Cloudflare Worker that aggregates content from RSS feeds, Reddit, and internal sources.
 * Implements the "Authority Engine" content pipeline:
 * 1. Fetch content from configured sources
 * 2. Parse and normalize into toast_hub_imports
 * 3. Score content for relevance/quality
 * 4. Admin reviews via Two-Gate System (pending -> approved -> visible)
 *
 * Architecture:
 * - Cron trigger runs every 2 hours
 * - Fetches from RSS feeds (Nation's Restaurant News, etc.)
 * - Fetches from Reddit (r/ToastPOS, r/restaurateur)
 * - Deduplicates via external_id
 * - Auto-disables failing sources after 5 consecutive failures
 */

interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  ENVIRONMENT: string;
  MAX_ITEMS_PER_SOURCE: string;
  MAX_CONSECUTIVE_FAILURES: string;
  FETCH_TIMEOUT_MS: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  OPENAI_API_KEY?: string;
}

interface ContentSource {
  id: string;
  name: string;
  source_type: 'rss' | 'reddit' | 'api' | 'manual' | 'data_context';
  feed_url: string | null;
  category_id: string | null;
  fetch_frequency_minutes: number;
  last_fetched_at: number | null;
  consecutive_failures: number;
  is_active: number;
}

interface ParsedItem {
  external_id: string;
  external_url: string;
  title: string;
  excerpt: string | null;
  content_body: string | null;
  author: string | null;
  published_at: number | null;
  category_suggestion: string | null;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// ============================================
// RSS PARSER
// ============================================

async function parseRSSFeed(
  feedUrl: string,
  timeout: number
): Promise<ParsedItem[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ToastHub-Aggregator/1.0 (R&G Consulting)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    return parseRSSXml(xml);
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseRSSXml(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];

  // Extract items from RSS 2.0 format
  const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid');
    const description = extractTag(itemXml, 'description') || extractTag(itemXml, 'content:encoded');
    const author = extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator');
    const pubDate = extractTag(itemXml, 'pubDate');
    const category = extractTag(itemXml, 'category');
    const guid = extractTag(itemXml, 'guid') || link;

    if (!title || !link) continue;

    items.push({
      external_id: guid || link,
      external_url: link,
      title: stripHtml(title),
      excerpt: description ? truncate(stripHtml(description), 500) : null,
      content_body: description ? stripHtml(description) : null,
      author: author ? stripHtml(author) : null,
      published_at: pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : null,
      category_suggestion: category ? stripHtml(category) : null,
    });
  }

  // Fallback: try Atom format if no RSS items found
  if (items.length === 0) {
    const entryMatches = xml.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi) || [];

    for (const entryXml of entryMatches) {
      const title = extractTag(entryXml, 'title');
      const link = extractAtomLink(entryXml);
      const summary = extractTag(entryXml, 'summary') || extractTag(entryXml, 'content');
      const author = extractTag(entryXml, 'name'); // Inside <author>
      const published = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated');
      const id = extractTag(entryXml, 'id') || link;

      if (!title || !link) continue;

      items.push({
        external_id: id || link,
        external_url: link,
        title: stripHtml(title),
        excerpt: summary ? truncate(stripHtml(summary), 500) : null,
        content_body: summary ? stripHtml(summary) : null,
        author: author ? stripHtml(author) : null,
        published_at: published ? Math.floor(new Date(published).getTime() / 1000) : null,
        category_suggestion: null,
      });
    }
  }

  return items;
}

function extractTag(xml: string, tagName: string): string | null {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];

  // Handle regular tags
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function extractAtomLink(xml: string): string | null {
  // Prefer alternate link, fallback to any link
  const alternateMatch = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (alternateMatch) return alternateMatch[1];

  const anyMatch = xml.match(/<link[^>]*href=["']([^"']+)["']/i);
  return anyMatch ? anyMatch[1] : null;
}

// ============================================
// REDDIT PARSER (RSS fallback)
// ============================================

async function parseRedditRSS(
  feedUrl: string,
  timeout: number
): Promise<ParsedItem[]> {
  // Reddit RSS feeds have specific formatting
  const items = await parseRSSFeed(feedUrl, timeout);

  // Clean up Reddit-specific formatting
  return items.map(item => ({
    ...item,
    // Reddit titles often have prefixes like [Question], [Help], etc.
    category_suggestion: extractRedditFlair(item.title),
    title: cleanRedditTitle(item.title),
  }));
}

function extractRedditFlair(title: string): string | null {
  const match = title.match(/^\[([^\]]+)\]/);
  return match ? match[1].toLowerCase() : null;
}

function cleanRedditTitle(title: string): string {
  return title.replace(/^\[[^\]]+\]\s*/, '').trim();
}

// ============================================
// CONTENT SCORING
// ============================================

function scoreContent(item: ParsedItem): number {
  let score = 50; // Base score

  // Title quality
  if (item.title.length >= 20 && item.title.length <= 100) score += 10;
  if (item.title.toLowerCase().includes('toast')) score += 15;
  if (item.title.toLowerCase().includes('pos')) score += 10;
  if (item.title.toLowerCase().includes('restaurant')) score += 5;

  // Content quality
  if (item.content_body && item.content_body.length > 200) score += 10;
  if (item.content_body && item.content_body.length > 500) score += 5;

  // Keywords that indicate valuable content
  const valuableKeywords = [
    'guide', 'tutorial', 'how to', 'tips', 'fix', 'solution',
    'issue', 'problem', 'help', 'setup', 'configure', 'integration'
  ];
  const titleLower = item.title.toLowerCase();
  const contentLower = (item.content_body || '').toLowerCase();

  for (const keyword of valuableKeywords) {
    if (titleLower.includes(keyword) || contentLower.includes(keyword)) {
      score += 5;
    }
  }

  // Cap score at 100
  return Math.min(score, 100);
}

// ============================================
// DATABASE OPERATIONS
// ============================================

async function getActiveSources(db: D1Database): Promise<ContentSource[]> {
  const result = await db.prepare(`
    SELECT id, name, source_type, feed_url, category_id,
           fetch_frequency_minutes, last_fetched_at, consecutive_failures, is_active
    FROM toast_hub_sources
    WHERE is_active = 1
      AND source_type IN ('rss', 'reddit')
      AND feed_url IS NOT NULL
  `).all<ContentSource>();

  return result.results || [];
}

async function isDuplicate(db: D1Database, externalId: string): Promise<boolean> {
  const result = await db.prepare(`
    SELECT 1 FROM toast_hub_imports WHERE external_id = ? LIMIT 1
  `).bind(externalId).first();

  return !!result;
}

async function insertImport(
  db: D1Database,
  sourceId: string,
  item: ParsedItem,
  score: number
): Promise<string> {
  const id = generateId('imp');

  await db.prepare(`
    INSERT INTO toast_hub_imports (
      id, source_id, external_id, external_url, title, excerpt,
      content_body, author, published_at, status,
      visible_public, visible_client_portal, visible_rep_portal,
      category_suggestion, ai_score, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, 0, ?, ?, ?, ?)
  `).bind(
    id,
    sourceId,
    item.external_id,
    item.external_url,
    item.title,
    item.excerpt,
    item.content_body,
    item.author,
    item.published_at,
    item.category_suggestion,
    score,
    unixNow(),
    unixNow()
  ).run();

  return id;
}

async function updateSourceFetchStatus(
  db: D1Database,
  sourceId: string,
  success: boolean,
  consecutiveFailures: number,
  maxFailures: number
): Promise<void> {
  if (success) {
    await db.prepare(`
      UPDATE toast_hub_sources
      SET last_fetched_at = ?, consecutive_failures = 0, updated_at = ?
      WHERE id = ?
    `).bind(unixNow(), unixNow(), sourceId).run();
  } else {
    const newFailures = consecutiveFailures + 1;
    const shouldDisable = newFailures >= maxFailures;

    await db.prepare(`
      UPDATE toast_hub_sources
      SET last_fetched_at = ?,
          consecutive_failures = ?,
          is_active = ?,
          last_error = 'Auto-disabled after consecutive failures',
          updated_at = ?
      WHERE id = ?
    `).bind(
      unixNow(),
      newFailures,
      shouldDisable ? 0 : 1,
      unixNow(),
      sourceId
    ).run();
  }
}

async function logAggregatorRun(
  db: D1Database,
  stats: {
    sourcesProcessed: number;
    itemsFetched: number;
    itemsImported: number;
    itemsDuplicated: number;
    itemsFailed: number;
    errors: string[];
    status: 'completed' | 'failed';
    startedAt: number;
  }
): Promise<void> {
  await db.prepare(`
    INSERT INTO toast_hub_aggregator_logs (
      id, run_started_at, run_completed_at,
      sources_processed, items_fetched, items_imported,
      items_duplicated, items_failed, errors_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    generateId('alog'),
    stats.startedAt,
    unixNow(),
    stats.sourcesProcessed,
    stats.itemsFetched,
    stats.itemsImported,
    stats.itemsDuplicated,
    stats.itemsFailed,
    JSON.stringify(stats.errors),
    stats.status,
    unixNow()
  ).run();
}

// ============================================
// MAIN AGGREGATOR LOGIC
// ============================================

async function runAggregation(env: Env): Promise<{
  sourcesProcessed: number;
  itemsFetched: number;
  itemsImported: number;
  itemsDuplicated: number;
  errors: string[];
}> {
  const maxItemsPerSource = parseInt(env.MAX_ITEMS_PER_SOURCE) || 50;
  const maxFailures = parseInt(env.MAX_CONSECUTIVE_FAILURES) || 5;
  const fetchTimeout = parseInt(env.FETCH_TIMEOUT_MS) || 10000;

  const stats = {
    sourcesProcessed: 0,
    itemsFetched: 0,
    itemsImported: 0,
    itemsDuplicated: 0,
    itemsFailed: 0,
    errors: [] as string[],
  };

  // Get active sources
  const sources = await getActiveSources(env.DB);
  console.log(`Found ${sources.length} active sources to process`);

  for (const source of sources) {
    try {
      console.log(`Processing source: ${source.name} (${source.source_type})`);
      let items: ParsedItem[] = [];

      // Fetch based on source type
      if (source.source_type === 'rss' && source.feed_url) {
        items = await parseRSSFeed(source.feed_url, fetchTimeout);
      } else if (source.source_type === 'reddit' && source.feed_url) {
        items = await parseRedditRSS(source.feed_url, fetchTimeout);
      }

      // Limit items per source
      items = items.slice(0, maxItemsPerSource);
      stats.itemsFetched += items.length;
      console.log(`Fetched ${items.length} items from ${source.name}`);

      // Process each item
      for (const item of items) {
        try {
          // Check for duplicates
          const isDupe = await isDuplicate(env.DB, item.external_id);
          if (isDupe) {
            stats.itemsDuplicated++;
            continue;
          }

          // Score content
          const score = scoreContent(item);

          // Insert into imports
          await insertImport(env.DB, source.id, item, score);
          stats.itemsImported++;
        } catch (err) {
          stats.itemsFailed++;
          console.error(`Error processing item: ${err}`);
        }
      }

      // Mark source as successfully fetched
      await updateSourceFetchStatus(env.DB, source.id, true, source.consecutive_failures, maxFailures);
      stats.sourcesProcessed++;

    } catch (err) {
      const errorMsg = `Source ${source.name}: ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(errorMsg);
      console.error(errorMsg);

      // Update source failure count
      await updateSourceFetchStatus(env.DB, source.id, false, source.consecutive_failures, maxFailures);
    }
  }

  return stats;
}

// ============================================
// WORKER HANDLERS
// ============================================

export default {
  // Scheduled handler (cron trigger)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Toast Hub Aggregator: Starting scheduled run');
    const startedAt = unixNow();

    try {
      const stats = await runAggregation(env);

      // Log the run
      await logAggregatorRun(env.DB, {
        ...stats,
        status: stats.errors.length === 0 ? 'completed' : 'completed',
        startedAt,
      });

      console.log(`Aggregation complete: ${stats.itemsImported} imported, ${stats.itemsDuplicated} duplicates, ${stats.errors.length} errors`);
    } catch (err) {
      console.error('Aggregation failed:', err);

      await logAggregatorRun(env.DB, {
        sourcesProcessed: 0,
        itemsFetched: 0,
        itemsImported: 0,
        itemsDuplicated: 0,
        itemsFailed: 0,
        errors: [err instanceof Error ? err.message : String(err)],
        status: 'failed',
        startedAt,
      });
    }
  },

  // HTTP handler (for manual triggers and status checks)
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: unixNow() }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get aggregation status
    if (url.pathname === '/status') {
      try {
        const latestRun = await env.DB.prepare(`
          SELECT * FROM toast_hub_aggregator_logs
          ORDER BY run_started_at DESC LIMIT 1
        `).first();

        const pendingCount = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM toast_hub_imports WHERE status = 'pending'
        `).first<{ count: number }>();

        const sourcesCount = await env.DB.prepare(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
          FROM toast_hub_sources
        `).first<{ total: number; active: number }>();

        return new Response(JSON.stringify({
          latestRun,
          pendingImports: pendingCount?.count || 0,
          sources: sourcesCount || { total: 0, active: 0 },
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // Manual trigger (POST /run)
    if (url.pathname === '/run' && request.method === 'POST') {
      const startedAt = unixNow();

      try {
        const stats = await runAggregation(env);

        await logAggregatorRun(env.DB, {
          ...stats,
          status: 'completed',
          startedAt,
        });

        return new Response(JSON.stringify({
          success: true,
          stats,
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          error: String(err),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    return new Response('Toast Hub Aggregator Worker', {
      headers: { 'Content-Type': 'text/plain', ...corsHeaders },
    });
  },
};
