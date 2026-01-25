// Public Toast Hub Search - Full-text search across posts and FAQs
import { corsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const db = env.DB;
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Search query must be at least 2 characters'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const searchTerm = `%${query}%`;

    // Search posts (published only)
    const { results: postResults } = await db.prepare(`
      SELECT
        id, slug, title, excerpt, category, published_at, view_count, featured,
        CASE
          WHEN title LIKE ? THEN 30
          WHEN tags_json LIKE ? THEN 20
          WHEN excerpt LIKE ? THEN 15
          WHEN content LIKE ? THEN 10
          ELSE 0
        END as relevance
      FROM toast_hub_posts
      WHERE status = 'published'
        AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ? OR tags_json LIKE ?)
      ORDER BY relevance DESC, featured DESC, published_at DESC
      LIMIT ? OFFSET ?
    `).bind(
      searchTerm, searchTerm, searchTerm, searchTerm,
      searchTerm, searchTerm, searchTerm, searchTerm,
      limit, offset
    ).all();

    // Search FAQs (active only)
    const { results: faqResults } = await db.prepare(`
      SELECT
        id, question, answer, category,
        CASE
          WHEN question LIKE ? THEN 30
          WHEN answer LIKE ? THEN 15
          ELSE 0
        END as relevance
      FROM toast_hub_faqs
      WHERE is_active = 1
        AND (question LIKE ? OR answer LIKE ?)
      ORDER BY relevance DESC, display_order ASC
      LIMIT 10
    `).bind(
      searchTerm, searchTerm,
      searchTerm, searchTerm
    ).all();

    // Format results with type
    const articles = (postResults || []).map(p => ({
      ...p,
      type: 'article',
      snippet: getSnippet(p.excerpt || '', query)
    }));

    const faqs = (faqResults || []).map(f => ({
      ...f,
      type: 'faq',
      snippet: getSnippet(f.answer, query)
    }));

    return new Response(JSON.stringify({
      success: true,
      query,
      data: {
        articles,
        faqs,
        total: articles.length + faqs.length
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

function getSnippet(text, query, maxLen = 200) {
  if (!text) return '';
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.substring(0, maxLen);

  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + query.length + 100);
  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

export async function onRequestOptions() {
  return handleOptions();
}
