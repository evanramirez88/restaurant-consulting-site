/**
 * Individual Fact API
 *
 * GET /api/admin/intelligence/facts/:id - Get fact details
 * PUT /api/admin/intelligence/facts/:id - Update fact
 * DELETE /api/admin/intelligence/facts/:id - Delete fact
 * POST /api/admin/intelligence/facts/:id - Actions (approve, reject)
 */

export async function onRequestGet(context) {
  const { params, env } = context;
  const { id } = params;

  try {
    const fact = await env.DB.prepare(`
      SELECT
        f.*,
        c.name as client_name,
        c.company as client_company,
        ai.name as ai_provider_name
      FROM client_atomic_facts f
      JOIN clients c ON f.client_id = c.id
      LEFT JOIN ai_providers ai ON f.ai_provider_id = ai.id
      WHERE f.id = ?
    `).bind(id).first();

    if (!fact) {
      return Response.json({
        success: false,
        error: 'Fact not found',
      }, { status: 404 });
    }

    return Response.json({
      success: true,
      fact,
    });
  } catch (error) {
    console.error('Fact GET error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, params, env } = context;
  const { id } = params;

  try {
    const body = await request.json();
    const { action, reviewed_by, rejection_reason } = body;

    // Get the fact
    const fact = await env.DB.prepare(
      'SELECT * FROM client_atomic_facts WHERE id = ?'
    ).bind(id).first();

    if (!fact) {
      return Response.json({
        success: false,
        error: 'Fact not found',
      }, { status: 404 });
    }

    if (action === 'approve') {
      // Update fact status
      await env.DB.prepare(`
        UPDATE client_atomic_facts
        SET status = 'approved', reviewed_by = ?, reviewed_at = unixepoch()
        WHERE id = ?
      `).bind(reviewed_by || 'admin', id).run();

      // Apply fact to client_profiles if it's a known field
      const profileFields = [
        'cuisine_type', 'service_style', 'bar_program', 'menu_complexity',
        'license_number', 'license_type', 'seating_capacity', 'square_footage',
        'employee_count', 'health_score', 'last_inspection_date', 'pos_system',
        'pos_account_id', 'online_ordering', 'reservation_system', 'website',
        'google_business_url', 'yelp_url', 'instagram_handle', 'facebook_url',
        'estimated_revenue_tier', 'avg_check_size', 'peak_hours', 'established_date',
      ];

      if (profileFields.includes(fact.field_name)) {
        // Check if profile exists
        const existingProfile = await env.DB.prepare(
          'SELECT id FROM client_profiles WHERE client_id = ?'
        ).bind(fact.client_id).first();

        if (existingProfile) {
          // Update existing profile
          await env.DB.prepare(`
            UPDATE client_profiles
            SET ${fact.field_name} = ?, updated_at = unixepoch()
            WHERE client_id = ?
          `).bind(fact.field_value, fact.client_id).run();
        } else {
          // Create new profile with this field
          const profileId = 'profile_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
          await env.DB.prepare(`
            INSERT INTO client_profiles (id, client_id, ${fact.field_name}, created_at, updated_at)
            VALUES (?, ?, ?, unixepoch(), unixepoch())
          `).bind(profileId, fact.client_id, fact.field_value).run();
        }
      }

      return Response.json({
        success: true,
        message: 'Fact approved and applied',
        field_applied: profileFields.includes(fact.field_name),
      });
    }

    if (action === 'reject') {
      await env.DB.prepare(`
        UPDATE client_atomic_facts
        SET status = 'rejected', reviewed_by = ?, reviewed_at = unixepoch(), rejection_reason = ?
        WHERE id = ?
      `).bind(reviewed_by || 'admin', rejection_reason || null, id).run();

      return Response.json({
        success: true,
        message: 'Fact rejected',
      });
    }

    return Response.json({
      success: false,
      error: 'Unknown action. Use "approve" or "reject"',
    }, { status: 400 });
  } catch (error) {
    console.error('Fact action error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { params, env } = context;
  const { id } = params;

  try {
    const result = await env.DB.prepare(
      'DELETE FROM client_atomic_facts WHERE id = ?'
    ).bind(id).run();

    if (result.meta?.changes === 0) {
      return Response.json({
        success: false,
        error: 'Fact not found',
      }, { status: 404 });
    }

    return Response.json({
      success: true,
      message: 'Fact deleted',
    });
  } catch (error) {
    console.error('Fact DELETE error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
