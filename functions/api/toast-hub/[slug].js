// Public Toast Hub Single Post API - Get post by slug and increment view count
// Updated for Authority Engine: includes GEO schema data for AI citation
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const { slug } = context.params;
    const url = new URL(context.request.url);
    const portal = url.searchParams.get('portal'); // 'client' | 'rep' | null

    // Get post (only if published and visible)
    let visibilityCondition = 'visible_public = 1';
    if (portal === 'client') {
      visibilityCondition = 'visible_client_portal = 1';
    } else if (portal === 'rep') {
      visibilityCondition = 'visible_rep_portal = 1';
    }

    const post = await db.prepare(`
      SELECT
        id, slug, title, excerpt, content, content_format, category, author,
        published_at, view_count, featured,
        meta_title, meta_description, og_image_url, tags_json,
        tldr_summary, expert_commentary, fact_highlights_json, faq_json,
        reading_time_minutes, source_type, source_url,
        visible_public, visible_client_portal, visible_rep_portal
      FROM toast_hub_posts
      WHERE slug = ? AND status = 'published' AND ${visibilityCondition}
    `).bind(slug).first();

    if (!post) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Increment view count (fire and forget)
    db.prepare(`
      UPDATE toast_hub_posts
      SET view_count = view_count + 1
      WHERE id = ?
    `).bind(post.id).run().catch(() => {});

    // Get related posts from same category (respecting visibility)
    const { results: relatedPosts } = await db.prepare(`
      SELECT id, slug, title, excerpt, category, published_at, featured, tldr_summary
      FROM toast_hub_posts
      WHERE status = 'published'
        AND ${visibilityCondition}
        AND id != ?
        AND (category = ? OR featured = 1)
      ORDER BY
        CASE WHEN category = ? THEN 0 ELSE 1 END,
        featured DESC,
        published_at DESC
      LIMIT 3
    `).bind(post.id, post.category, post.category).all();

    // Parse JSON fields
    let factHighlights = [];
    let faqs = [];
    let tags = [];

    try {
      if (post.fact_highlights_json) {
        factHighlights = JSON.parse(post.fact_highlights_json);
      }
    } catch {}

    try {
      if (post.faq_json) {
        faqs = JSON.parse(post.faq_json);
      }
    } catch {}

    try {
      if (post.tags_json) {
        tags = JSON.parse(post.tags_json);
      }
    } catch {}

    // Build GEO-optimized schema.org data for AI citation
    const schemaOrg = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": post.title,
      "description": post.tldr_summary || post.excerpt || post.meta_description,
      "author": {
        "@type": "Person",
        "name": post.author || "Evan Ramirez",
        "jobTitle": "Restaurant Technology Consultant",
        "url": "https://ccrestaurantconsulting.com"
      },
      "publisher": {
        "@type": "Organization",
        "name": "R&G Consulting",
        "url": "https://ccrestaurantconsulting.com"
      },
      "datePublished": post.published_at ? new Date(post.published_at * 1000).toISOString() : null,
      "mainEntityOfPage": `https://ccrestaurantconsulting.com/toast-hub/${post.slug}`,
      "articleSection": post.category,
      "keywords": tags.join(', ')
    };

    // Add FAQPage schema if FAQs exist (increases AI citation by ~28%)
    if (faqs.length > 0) {
      schemaOrg.mainEntity = {
        "@type": "FAQPage",
        "mainEntity": faqs.map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      };
    }

    // Calculate reading time if not set
    const readingTime = post.reading_time_minutes ||
      Math.ceil((post.content?.split(/\s+/).length || 0) / 200);

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...post,
        tags,
        fact_highlights: factHighlights,
        faqs,
        reading_time_minutes: readingTime,
        relatedPosts: relatedPosts || [],
        schema_org: schemaOrg
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
