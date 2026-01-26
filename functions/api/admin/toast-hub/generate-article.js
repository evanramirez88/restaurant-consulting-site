// AI-Assisted Article Generation for Toast Hub
// POST /api/admin/toast-hub/generate-article
// Uses Claude API to generate article drafts based on topic and keywords
import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    const {
      topic,
      category,
      keywords = [],
      style = 'professional, helpful, actionable',
      word_count = 1500,
      include_sections = true,
      save_as_draft = true
    } = body;

    if (!topic) {
      return new Response(JSON.stringify({
        success: false,
        error: 'topic is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check for Anthropic API key
    if (!context.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'AI generation not configured. Set ANTHROPIC_API_KEY environment variable.'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Build the generation prompt
    const systemPrompt = `You are a content writer for R&G Consulting, a restaurant consulting firm specializing in Toast POS. Write SEO-optimized content that's helpful, actionable, and positions R&G as experts.

Guidelines:
- Use markdown formatting
- Include practical examples from a restaurant consultant's perspective
- Add "Pro Tip" callouts with insider advice
- Be specific and actionable, not generic
- Target restaurant owners and managers as the audience
- Naturally incorporate the target keywords
- End with a clear call-to-action to schedule a consultation
- Maintain a ${style} tone throughout`;

    const userPrompt = `Write a comprehensive article about: ${topic}

Target word count: ${word_count} words
Category: ${category || 'General'}
Target keywords: ${keywords.length > 0 ? keywords.join(', ') : 'None specified'}

${include_sections ? `Include:
- Engaging introduction that hooks the reader
- "What You'll Learn" bullet points
- Clear H2 and H3 headings for structure
- Practical examples and step-by-step instructions
- Common mistakes to avoid section
- "Next Steps" or conclusion with call-to-action
- Pro tips throughout marked with "> **Pro Tip:**"` : 'Write as a cohesive article without strict section requirements.'}

At the end, add a call-to-action directing readers to schedule a consultation at /contact.

Format the entire response as clean markdown.`;

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': context.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      return new Response(JSON.stringify({
        success: false,
        error: `AI generation failed: ${errData.error?.message || 'Unknown error'}`
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Extract title from content (first # heading)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const extractedTitle = titleMatch ? titleMatch[1] : topic;

    // Create slug from title
    const slug = extractedTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);

    // Extract excerpt (first paragraph after title)
    const excerptMatch = content.match(/^#.+\n\n(.+?)(?:\n\n|$)/s);
    const excerpt = excerptMatch
      ? excerptMatch[1].replace(/\*\*/g, '').substring(0, 300)
      : '';

    let articleId = null;
    let savedPost = null;

    // Save as draft if requested
    if (save_as_draft) {
      articleId = crypto.randomUUID();

      await db.prepare(`
        INSERT INTO toast_hub_posts (
          id, title, slug, excerpt, content, content_format, category,
          tags_json, status, author, featured, display_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'markdown', ?, ?, 'draft', 'AI Generated', 0, 0, ?, ?)
      `).bind(
        articleId,
        extractedTitle,
        slug,
        excerpt,
        content,
        category || null,
        keywords.length > 0 ? JSON.stringify(keywords) : null,
        now,
        now
      ).run();

      // Fetch saved post
      savedPost = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(articleId).first();
    }

    // Calculate tokens used
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;

    return new Response(JSON.stringify({
      success: true,
      data: {
        article_id: articleId,
        title: extractedTitle,
        slug,
        excerpt,
        content,
        category,
        keywords,
        word_count: content.split(/\s+/).length,
        saved_as_draft: save_as_draft,
        post: savedPost
      },
      meta: {
        model: 'claude-sonnet-4-20250514',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        generated_at: new Date().toISOString()
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

// GET - List recent AI-generated articles
export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Get recently created drafts by AI
    const { results } = await db.prepare(`
      SELECT id, title, slug, excerpt, category, status, created_at, updated_at
      FROM toast_hub_posts
      WHERE author = 'AI Generated'
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
