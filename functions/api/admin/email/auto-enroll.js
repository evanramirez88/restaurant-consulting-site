/**
 * Auto-Enrollment Endpoint
 * Automatically enrolls scored leads into appropriate email sequences
 *
 * POST /api/admin/email/auto-enroll
 * Body: {
 *   segment?: 'A' | 'B' | 'C' | 'D',  // Filter to specific segment
 *   minScore?: number,                 // Minimum lead score (default 0)
 *   limit?: number,                    // Max leads to process (default 100)
 *   dryRun?: boolean                   // Preview only, don't enroll
 * }
 *
 * GET /api/admin/email/auto-enroll
 * Returns statistics on enrollable leads
 */

// POS System to Segment mapping
const POS_TO_SEGMENT = {
  // Segment A - POS Switchers
  'Clover': 'A',
  'Square': 'A',
  'Lightspeed': 'A',
  'Upserve': 'A',
  'Harbortouch': 'A',
  'TouchBistro': 'A',
  'Micros': 'A',
  'Aloha': 'A',

  // Segment B - Toast Optimizers
  'Toast': 'B'
};

// Segment to Sequence mapping
const SEGMENT_SEQUENCES = {
  'A': 'seq_pos_switcher_001',      // POS Switcher Outreach
  'B': 'seq_toast_support_001',     // Toast Support Plan Outreach
  'C': 'seq_transition_001',        // Ownership Transition Outreach
  'D': 'seq_local_network_001'      // Local Network Outreach
};

// Segment to Door mapping
const SEGMENT_DOORS = {
  'A': 'national_remote',
  'B': 'national_remote',
  'C': 'national_remote',
  'D': 'local_regional'
};

// MA/Local states for Segment D detection
const LOCAL_STATES = ['MA', 'RI'];

/**
 * Determine segment for a lead based on POS and geography
 */
function determineSegment(lead) {
  const pos = lead.current_pos || '';
  const state = (lead.state || '').toUpperCase();

  // Check for Segment D (Local) first - geography takes precedence
  if (LOCAL_STATES.includes(state)) {
    return 'D';
  }

  // Check POS-based segment
  if (POS_TO_SEGMENT[pos]) {
    return POS_TO_SEGMENT[pos];
  }

  // Default to A for unknown POS (assume switcher potential)
  return 'A';
}

/**
 * POST: Auto-enroll leads into email sequences
 */
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      segment: filterSegment,
      minScore = 0,
      limit = 100,
      dryRun = false
    } = body;

    // Build query to find enrollable leads
    let query = `
      SELECT
        rl.id,
        rl.domain,
        rl.company,
        rl.city,
        rl.state,
        rl.email,
        rl.phone,
        rl.current_pos,
        rl.lead_score
      FROM restaurant_leads rl
      WHERE rl.email IS NOT NULL
        AND rl.email != ''
        AND rl.lead_score >= ?
        AND NOT EXISTS (
          SELECT 1 FROM email_subscribers es
          WHERE LOWER(es.email) = LOWER(rl.email)
        )
    `;

    const params = [minScore];

    // Filter by POS if segment specified
    if (filterSegment === 'A') {
      query += ` AND rl.current_pos IN ('Clover', 'Square', 'Lightspeed', 'Upserve', 'Harbortouch', 'TouchBistro', 'Micros', 'Aloha')`;
    } else if (filterSegment === 'B') {
      query += ` AND rl.current_pos = 'Toast'`;
    } else if (filterSegment === 'D') {
      query += ` AND UPPER(rl.state) IN ('MA', 'RI')`;
    }

    query += ` ORDER BY rl.lead_score DESC LIMIT ?`;
    params.push(limit);

    // Fetch enrollable leads
    const leadsResult = await env.DB.prepare(query).bind(...params).all();
    const leads = leadsResult.results || [];

    if (leads.length === 0) {
      return Response.json({
        success: true,
        message: 'No enrollable leads found matching criteria',
        enrolled: 0,
        criteria: { filterSegment, minScore, limit }
      });
    }

    // Dry run - just return what would be enrolled
    if (dryRun) {
      const preview = leads.map(lead => ({
        email: lead.email,
        company: lead.company,
        currentPos: lead.current_pos,
        state: lead.state,
        score: lead.lead_score,
        assignedSegment: determineSegment(lead),
        sequence: SEGMENT_SEQUENCES[determineSegment(lead)]
      }));

      return Response.json({
        success: true,
        dryRun: true,
        wouldEnroll: leads.length,
        preview: preview.slice(0, 20), // Show first 20
        segmentBreakdown: {
          A: preview.filter(p => p.assignedSegment === 'A').length,
          B: preview.filter(p => p.assignedSegment === 'B').length,
          C: preview.filter(p => p.assignedSegment === 'C').length,
          D: preview.filter(p => p.assignedSegment === 'D').length
        }
      });
    }

    // Process enrollments
    const results = {
      enrolled: 0,
      skipped: 0,
      errors: [],
      bySegment: { A: 0, B: 0, C: 0, D: 0 }
    };

    for (const lead of leads) {
      try {
        const segment = determineSegment(lead);
        const sequenceId = SEGMENT_SEQUENCES[segment];
        const door = SEGMENT_DOORS[segment];

        if (!sequenceId) {
          results.skipped++;
          continue;
        }

        // Check sequence exists and is active
        const sequence = await env.DB.prepare(
          'SELECT id, name, status FROM email_sequences WHERE id = ?'
        ).bind(sequenceId).first();

        if (!sequence || sequence.status !== 'active') {
          results.errors.push({ email: lead.email, error: `Sequence ${sequenceId} not active` });
          results.skipped++;
          continue;
        }

        // Check suppression list
        const suppressed = await env.DB.prepare(
          'SELECT 1 FROM email_suppression_list WHERE email = ?'
        ).bind(lead.email.toLowerCase()).first();

        if (suppressed) {
          results.skipped++;
          continue;
        }

        // Create subscriber record
        const subscriberResult = await env.DB.prepare(`
          INSERT INTO email_subscribers (
            email,
            first_name,
            company,
            status,
            segment,
            door,
            current_pos,
            lead_score,
            source,
            enrollment_source,
            enrolled_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, 'active', ?, ?, ?, ?, 'builtwith_import', 'auto_enroll', ?, ?, ?)
        `).bind(
          lead.email.toLowerCase(),
          lead.company ? lead.company.split(' ')[0] : null, // Use first word of company as name
          lead.company || null,
          segment,
          door,
          lead.current_pos || null,
          lead.lead_score || 0,
          Date.now(),
          Date.now(),
          Date.now()
        ).run();

        const subscriberId = subscriberResult.meta.last_row_id;

        // Get first step of sequence
        const firstStep = await env.DB.prepare(`
          SELECT id, delay_minutes
          FROM sequence_steps
          WHERE sequence_id = ?
          ORDER BY step_order ASC
          LIMIT 1
        `).bind(sequenceId).first();

        if (!firstStep) {
          results.errors.push({ email: lead.email, error: 'Sequence has no steps' });
          results.skipped++;
          continue;
        }

        // Calculate next execution time
        const delayMs = (firstStep.delay_minutes || 0) * 60 * 1000;
        const nextExecutionTime = Date.now() + delayMs;

        // Enroll in sequence
        await env.DB.prepare(`
          INSERT INTO subscriber_sequences (
            subscriber_id,
            sequence_id,
            status,
            current_step,
            current_step_id,
            next_execution_time,
            enrolled_at,
            updated_at
          )
          VALUES (?, ?, 'active', 1, ?, ?, ?, ?)
        `).bind(
          subscriberId,
          sequenceId,
          firstStep.id,
          nextExecutionTime,
          Date.now(),
          Date.now()
        ).run();

        // Update restaurant_leads with enrollment info
        await env.DB.prepare(`
          UPDATE restaurant_leads
          SET
            segment = ?,
            email_enrolled_at = ?,
            email_sequence_id = ?
          WHERE id = ?
        `).bind(segment, Date.now(), sequenceId, lead.id).run();

        results.enrolled++;
        results.bySegment[segment]++;

      } catch (err) {
        results.errors.push({ email: lead.email, error: err.message });
      }
    }

    return Response.json({
      success: true,
      message: `Enrolled ${results.enrolled} leads into email sequences`,
      enrolled: results.enrolled,
      skipped: results.skipped,
      bySegment: results.bySegment,
      errors: results.errors.slice(0, 10) // Show first 10 errors
    });

  } catch (error) {
    console.error('Auto-enroll error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * GET: Statistics on enrollable leads
 */
export async function onRequestGet({ env }) {
  try {
    // Count total leads with email
    const totalWithEmail = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM restaurant_leads
      WHERE email IS NOT NULL AND email != ''
    `).first();

    // Count already enrolled
    const alreadyEnrolled = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM email_subscribers
    `).first();

    // Count by segment potential
    const segmentCounts = await env.DB.prepare(`
      SELECT
        current_pos,
        state,
        COUNT(*) as count,
        SUM(CASE WHEN lead_score >= 80 THEN 1 ELSE 0 END) as high_value,
        AVG(lead_score) as avg_score
      FROM restaurant_leads
      WHERE email IS NOT NULL
        AND email != ''
        AND NOT EXISTS (
          SELECT 1 FROM email_subscribers es
          WHERE LOWER(es.email) = LOWER(restaurant_leads.email)
        )
      GROUP BY current_pos
      ORDER BY count DESC
    `).all();

    // Count MA leads (Segment D potential)
    const localLeads = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM restaurant_leads
      WHERE email IS NOT NULL
        AND email != ''
        AND UPPER(state) IN ('MA', 'RI')
        AND NOT EXISTS (
          SELECT 1 FROM email_subscribers es
          WHERE LOWER(es.email) = LOWER(restaurant_leads.email)
        )
    `).first();

    // Summarize by segment
    const posCounts = segmentCounts.results || [];
    const summary = {
      A: 0, // Switchers
      B: 0, // Toast
      D: localLeads?.count || 0 // Local
    };

    for (const row of posCounts) {
      const segment = POS_TO_SEGMENT[row.current_pos];
      if (segment === 'A') summary.A += row.count;
      if (segment === 'B') summary.B += row.count;
    }

    return Response.json({
      success: true,
      stats: {
        totalLeadsWithEmail: totalWithEmail?.count || 0,
        alreadyEnrolled: alreadyEnrolled?.count || 0,
        availableToEnroll: (totalWithEmail?.count || 0) - (alreadyEnrolled?.count || 0),
        bySegmentPotential: summary,
        byPOS: posCounts
      },
      sequences: {
        A: { id: 'seq_pos_switcher_001', name: 'POS Switcher Outreach', door: 'national_remote' },
        B: { id: 'seq_toast_support_001', name: 'Toast Support Plan Outreach', door: 'national_remote' },
        C: { id: 'seq_transition_001', name: 'Ownership Transition Outreach', door: 'national_remote' },
        D: { id: 'seq_local_network_001', name: 'Local Network Outreach', door: 'local_regional' }
      },
      usage: {
        endpoint: 'POST /api/admin/email/auto-enroll',
        body: {
          segment: 'A | B | C | D (optional)',
          minScore: 'number (default 0)',
          limit: 'number (default 100)',
          dryRun: 'boolean (default false)'
        }
      }
    });

  } catch (error) {
    console.error('Auto-enroll stats error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
