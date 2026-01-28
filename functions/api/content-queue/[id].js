/**
 * Content Queue Item API - Restaurant Wrap Pipeline
 * 
 * GET /api/content-queue/:id - Get single queue item
 * PATCH /api/content-queue/:id - Update queue item (status, assignment, notes)
 * DELETE /api/content-queue/:id - Delete queue item
 */

export async function onRequestGet(context) {
  const { env, params } = context;
  const { id } = params;
  
  try {
    const item = await env.DB.prepare(`
      SELECT 
        id,
        source_content_title,
        source_content_url,
        source_content_source,
        source_content_excerpt,
        source_external_id,
        seo_primary_keyword,
        seo_secondary_keywords_json,
        seo_long_tail_keywords_json,
        seo_meta_title,
        seo_meta_description,
        seo_suggested_slug,
        seo_target_word_count_min,
        seo_target_word_count_max,
        seo_search_intent,
        structure_headline,
        structure_subheadlines_json,
        structure_sections_json,
        structure_cta_placement_json,
        structure_internal_links_json,
        summary_key_points_json,
        summary_expert_angle,
        summary_unique_value,
        summary_target_audience,
        publishing_category,
        publishing_tags_json,
        publishing_priority,
        publishing_estimated_effort,
        publishing_timeliness,
        score_seo_opportunity,
        score_content_gap,
        score_competitive_difficulty,
        score_overall_priority,
        status,
        assigned_to,
        review_notes,
        rejection_reason,
        published_post_id,
        published_at,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM content_queue 
      WHERE id = ?
    `).bind(id).first();
    
    if (!item) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Queue item not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse JSON fields
    const parsedItem = {
      ...item,
      seo_secondary_keywords: JSON.parse(item.seo_secondary_keywords_json || '[]'),
      seo_long_tail_keywords: JSON.parse(item.seo_long_tail_keywords_json || '[]'),
      structure_subheadlines: JSON.parse(item.structure_subheadlines_json || '[]'),
      structure_sections: JSON.parse(item.structure_sections_json || '[]'),
      structure_cta_placement: JSON.parse(item.structure_cta_placement_json || '[]'),
      structure_internal_links: JSON.parse(item.structure_internal_links_json || '[]'),
      summary_key_points: JSON.parse(item.summary_key_points_json || '[]'),
      publishing_tags: JSON.parse(item.publishing_tags_json || '[]'),
    };
    
    return new Response(JSON.stringify({
      success: true,
      data: parsedItem
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Content queue get error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPatch(context) {
  const { env, params, request } = context;
  const { id } = params;
  
  try {
    const body = await request.json();
    const now = Math.floor(Date.now() / 1000);
    
    // Check item exists
    const existing = await env.DB.prepare(
      'SELECT id, status FROM content_queue WHERE id = ?'
    ).bind(id).first();
    
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Queue item not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Build update query
    const updates = [];
    const values = [];
    
    // Status update
    if (body.status) {
      const validStatuses = ['pending', 'in_review', 'writing', 'editing', 'approved', 'published', 'rejected', 'archived'];
      if (!validStatuses.includes(body.status)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updates.push('status = ?');
      values.push(body.status);
      
      // If publishing, record timestamp
      if (body.status === 'published' && body.published_post_id) {
        updates.push('published_at = ?');
        values.push(now);
        updates.push('published_post_id = ?');
        values.push(body.published_post_id);
      }
      
      // If rejecting, require reason
      if (body.status === 'rejected' && body.rejection_reason) {
        updates.push('rejection_reason = ?');
        values.push(body.rejection_reason);
      }
    }
    
    // Assignment
    if (body.assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      values.push(body.assigned_to);
    }
    
    // Review notes
    if (body.review_notes !== undefined) {
      updates.push('review_notes = ?');
      values.push(body.review_notes);
    }
    
    // Priority
    if (body.publishing_priority) {
      const validPriorities = ['high', 'medium', 'low'];
      if (!validPriorities.includes(body.publishing_priority)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updates.push('publishing_priority = ?');
      values.push(body.publishing_priority);
    }
    
    // Category
    if (body.publishing_category) {
      updates.push('publishing_category = ?');
      values.push(body.publishing_category);
    }
    
    // SEO fields
    if (body.seo_meta_title) {
      updates.push('seo_meta_title = ?');
      values.push(body.seo_meta_title);
    }
    if (body.seo_meta_description) {
      updates.push('seo_meta_description = ?');
      values.push(body.seo_meta_description);
    }
    if (body.seo_primary_keyword) {
      updates.push('seo_primary_keyword = ?');
      values.push(body.seo_primary_keyword);
    }
    
    // Always update timestamp
    updates.push('updated_at = ?');
    values.push(now);
    
    if (body.updated_by) {
      updates.push('updated_by = ?');
      values.push(body.updated_by);
    }
    
    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid fields to update'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    values.push(id);
    
    await env.DB.prepare(`
      UPDATE content_queue 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();
    
    return new Response(JSON.stringify({
      success: true,
      data: { id, updated: updates.length - 1 } // -1 for updated_at
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Content queue update error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const { id } = params;
  
  try {
    // Check item exists
    const existing = await env.DB.prepare(
      'SELECT id, status FROM content_queue WHERE id = ?'
    ).bind(id).first();
    
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Queue item not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Don't allow deleting published items (archive instead)
    if (existing.status === 'published') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot delete published items. Use archive status instead.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await env.DB.prepare('DELETE FROM content_queue WHERE id = ?').bind(id).run();
    
    return new Response(JSON.stringify({
      success: true,
      data: { id, deleted: true }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Content queue delete error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
