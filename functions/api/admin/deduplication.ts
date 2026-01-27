/**
 * Deduplication & Entity Resolution API
 * 
 * GET /api/admin/deduplication - List duplicate candidates
 * POST /api/admin/deduplication - Merge duplicates or update status
 * 
 * Query params (GET):
 *   - status: pending|confirmed|rejected|merged|deferred
 *   - minConfidence: minimum confidence score (0-1)
 *   - maxConfidence: maximum confidence score (0-1)
 *   - sourceTable: filter by source table
 *   - targetTable: filter by target table
 *   - limit: results per page (default 50, max 200)
 *   - offset: pagination offset
 *   - includeStats: include summary statistics
 * 
 * POST body:
 *   - action: merge|reject|defer|confirm|scan
 *   - candidateId: duplicate candidate ID (for single actions)
 *   - candidateIds: array of IDs (for bulk actions)
 *   - canonicalId: which entity to keep (for merge)
 *   - mergedId: which entity to merge away
 *   - notes: optional notes
 *   - scanOptions: options for scan action
 */

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../_shared/auth.js';

interface Env {
  DB: D1Database;
}

interface DuplicateCandidate {
  id: string;
  entity1_table: string;
  entity1_id: string;
  entity2_table: string;
  entity2_id: string;
  confidence_score: number;
  match_details: string | null;
  status: string;
  rule_name?: string;
  found_at: number;
  reviewed_by?: string;
  reviewed_at?: number;
}

interface MergeRequest {
  action: 'merge' | 'reject' | 'defer' | 'confirm' | 'scan' | 'bulk_update';
  candidateId?: string;
  candidateIds?: string[];
  canonicalTable?: string;
  canonicalId?: string;
  mergedTable?: string;
  mergedId?: string;
  notes?: string;
  scanOptions?: {
    tables?: string[];
    ruleIds?: string[];
    maxResults?: number;
  };
  newStatus?: string;
}

function getCorsHeaders(request: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

function generateId(): string {
  return `dup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * GET /api/admin/deduplication
 * Retrieve duplicate candidates with filtering
 */
export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '0');
    const maxConfidence = parseFloat(url.searchParams.get('maxConfidence') || '1');
    const sourceTable = url.searchParams.get('sourceTable');
    const targetTable = url.searchParams.get('targetTable');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const includeStats = url.searchParams.get('includeStats') === 'true';

    // Build query
    let query = `
      SELECT 
        dc.id,
        dc.entity1_table,
        dc.entity1_id,
        dc.entity2_table,
        dc.entity2_id,
        dc.confidence_score,
        dc.match_details,
        dc.status,
        dc.found_at,
        dc.reviewed_by,
        dc.reviewed_at,
        dc.review_notes,
        err.name as rule_name
      FROM duplicate_candidates dc
      LEFT JOIN entity_resolution_rules err ON dc.rule_id = err.id
      WHERE dc.status = ?
        AND dc.confidence_score >= ?
        AND dc.confidence_score <= ?
    `;
    const params: (string | number)[] = [status, minConfidence, maxConfidence];

    if (sourceTable) {
      query += ` AND (dc.entity1_table = ? OR dc.entity2_table = ?)`;
      params.push(sourceTable, sourceTable);
    }

    if (targetTable) {
      query += ` AND (dc.entity1_table = ? OR dc.entity2_table = ?)`;
      params.push(targetTable, targetTable);
    }

    query += ` ORDER BY dc.confidence_score DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const candidates = await env.DB.prepare(query).bind(...params).all<DuplicateCandidate>();

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM duplicate_candidates dc
      WHERE dc.status = ?
        AND dc.confidence_score >= ?
        AND dc.confidence_score <= ?
    `;
    const countParams: (string | number)[] = [status, minConfidence, maxConfidence];

    if (sourceTable) {
      countQuery += ` AND (dc.entity1_table = ? OR dc.entity2_table = ?)`;
      countParams.push(sourceTable, sourceTable);
    }

    if (targetTable) {
      countQuery += ` AND (dc.entity1_table = ? OR dc.entity2_table = ?)`;
      countParams.push(targetTable, targetTable);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();

    // Optionally include stats
    let stats = null;
    if (includeStats) {
      const statsResult = await env.DB.prepare(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence,
          MIN(confidence_score) as min_confidence,
          MAX(confidence_score) as max_confidence
        FROM duplicate_candidates
        GROUP BY status
      `).all();

      const rulesResult = await env.DB.prepare(`
        SELECT 
          err.name,
          COUNT(dc.id) as matches_found
        FROM entity_resolution_rules err
        LEFT JOIN duplicate_candidates dc ON dc.rule_id = err.id
        WHERE err.is_active = 1
        GROUP BY err.id
      `).all();

      stats = {
        byStatus: statsResult.results,
        byRule: rulesResult.results,
        lastScan: await env.DB.prepare(`
          SELECT id, started_at, completed_at, records_scanned, candidates_found, status
          FROM deduplication_runs
          ORDER BY started_at DESC
          LIMIT 1
        `).first()
      };
    }

    // Enrich candidates with entity data
    const enrichedCandidates = await Promise.all(
      (candidates.results || []).map(async (candidate) => {
        const entity1 = await getEntityPreview(env.DB, candidate.entity1_table, candidate.entity1_id);
        const entity2 = await getEntityPreview(env.DB, candidate.entity2_table, candidate.entity2_id);
        
        return {
          ...candidate,
          match_details: candidate.match_details ? JSON.parse(candidate.match_details) : null,
          entity1_preview: entity1,
          entity2_preview: entity2
        };
      })
    );

    return new Response(JSON.stringify({
      success: true,
      candidates: enrichedCandidates,
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        hasMore: offset + limit < (countResult?.total || 0)
      },
      stats
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Deduplication GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: corsHeaders });
  }
}

/**
 * POST /api/admin/deduplication
 * Perform merge, reject, or scan operations
 */
export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body: MergeRequest = await request.json();
    const userId = auth.user?.id || 'system';

    switch (body.action) {
      case 'merge':
        return await handleMerge(env.DB, body, userId, corsHeaders);
      
      case 'reject':
      case 'defer':
      case 'confirm':
        return await handleStatusUpdate(env.DB, body, userId, corsHeaders);
      
      case 'bulk_update':
        return await handleBulkUpdate(env.DB, body, userId, corsHeaders);
      
      case 'scan':
        return await handleScan(env.DB, body, userId, corsHeaders);
      
      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unknown action: ${body.action}`
        }), { status: 400, headers: corsHeaders });
    }

  } catch (error) {
    console.error('Deduplication POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: corsHeaders });
  }
}

/**
 * Handle OPTIONS for CORS
 */
export async function onRequestOptions(context: { request: Request }) {
  return handleOptions(context.request);
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get a preview of an entity for display
 */
async function getEntityPreview(
  db: D1Database, 
  tableName: string, 
  entityId: string
): Promise<Record<string, unknown> | null> {
  const tableFields: Record<string, string[]> = {
    restaurant_leads: ['id', 'name', 'dba_name', 'primary_email', 'primary_phone', 'city', 'state', 'status'],
    clients: ['id', 'name', 'email', 'phone', 'status'],
    client_profiles: ['id', 'business_name', 'contact_email', 'contact_phone'],
    contact_submissions: ['id', 'name', 'email', 'phone', 'company', 'submitted_at'],
    synced_contacts: ['id', 'email', 'name', 'phone', 'source'],
    organizations: ['id', 'legal_name', 'dba_name', 'lifecycle_stage'],
    org_contacts: ['id', 'first_name', 'last_name', 'email', 'phone']
  };

  const fields = tableFields[tableName];
  if (!fields) return null;

  try {
    const result = await db.prepare(
      `SELECT ${fields.join(', ')} FROM ${tableName} WHERE id = ?`
    ).bind(entityId).first();
    return result;
  } catch {
    return null;
  }
}

/**
 * Handle merge action
 */
async function handleMerge(
  db: D1Database, 
  body: MergeRequest, 
  userId: string, 
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!body.candidateId || !body.canonicalId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'candidateId and canonicalId are required'
    }), { status: 400, headers: corsHeaders });
  }

  // Get the candidate
  const candidate = await db.prepare(`
    SELECT * FROM duplicate_candidates WHERE id = ?
  `).bind(body.candidateId).first<DuplicateCandidate>();

  if (!candidate) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Candidate not found'
    }), { status: 404, headers: corsHeaders });
  }

  // Determine which entity is canonical and which is merged
  let canonicalTable: string, canonicalId: string, mergedTable: string, mergedId: string;
  
  if (body.canonicalId === candidate.entity1_id) {
    canonicalTable = candidate.entity1_table;
    canonicalId = candidate.entity1_id;
    mergedTable = candidate.entity2_table;
    mergedId = candidate.entity2_id;
  } else {
    canonicalTable = candidate.entity2_table;
    canonicalId = candidate.entity2_id;
    mergedTable = candidate.entity1_table;
    mergedId = candidate.entity1_id;
  }

  // Get merged entity data for preservation
  const mergedEntity = await getEntityPreview(db, mergedTable, mergedId);

  // Create merge record
  const mergeId = generateId().replace('dup_', 'merge_');
  await db.prepare(`
    INSERT INTO merged_entities (
      id, canonical_table, canonical_id, merged_table, merged_id,
      duplicate_candidate_id, confidence_score, merge_type,
      merged_data, merged_by, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)
  `).bind(
    mergeId,
    canonicalTable,
    canonicalId,
    mergedTable,
    mergedId,
    body.candidateId,
    candidate.confidence_score,
    JSON.stringify(mergedEntity),
    userId,
    body.notes || null
  ).run();

  // Update candidate status
  await db.prepare(`
    UPDATE duplicate_candidates 
    SET status = 'merged', reviewed_by = ?, reviewed_at = unixepoch(), review_notes = ?
    WHERE id = ?
  `).bind(userId, body.notes || null, body.candidateId).run();

  // Mark merged entity as inactive/merged if the table supports it
  try {
    await db.prepare(`
      UPDATE ${mergedTable} 
      SET status = 'merged', merged_into_id = ?, updated_at = unixepoch()
      WHERE id = ?
    `).bind(canonicalId, mergedId).run();
  } catch {
    // Table might not have status/merged_into_id columns - that's OK
    console.log(`Could not update ${mergedTable} status - may not have required columns`);
  }

  return new Response(JSON.stringify({
    success: true,
    mergeId,
    message: `Successfully merged ${mergedTable}:${mergedId} into ${canonicalTable}:${canonicalId}`
  }), { headers: corsHeaders });
}

/**
 * Handle status update (reject, defer, confirm)
 */
async function handleStatusUpdate(
  db: D1Database, 
  body: MergeRequest, 
  userId: string, 
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!body.candidateId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'candidateId is required'
    }), { status: 400, headers: corsHeaders });
  }

  const newStatus = body.action === 'reject' ? 'rejected' 
    : body.action === 'defer' ? 'deferred' 
    : 'confirmed';

  await db.prepare(`
    UPDATE duplicate_candidates 
    SET status = ?, reviewed_by = ?, reviewed_at = unixepoch(), review_notes = ?
    WHERE id = ?
  `).bind(newStatus, userId, body.notes || null, body.candidateId).run();

  return new Response(JSON.stringify({
    success: true,
    message: `Candidate marked as ${newStatus}`
  }), { headers: corsHeaders });
}

/**
 * Handle bulk status update
 */
async function handleBulkUpdate(
  db: D1Database, 
  body: MergeRequest, 
  userId: string, 
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!body.candidateIds || !body.newStatus) {
    return new Response(JSON.stringify({
      success: false,
      error: 'candidateIds and newStatus are required'
    }), { status: 400, headers: corsHeaders });
  }

  const placeholders = body.candidateIds.map(() => '?').join(',');
  await db.prepare(`
    UPDATE duplicate_candidates 
    SET status = ?, reviewed_by = ?, reviewed_at = unixepoch()
    WHERE id IN (${placeholders})
  `).bind(body.newStatus, userId, ...body.candidateIds).run();

  return new Response(JSON.stringify({
    success: true,
    message: `Updated ${body.candidateIds.length} candidates to ${body.newStatus}`
  }), { headers: corsHeaders });
}

/**
 * Handle scan action - find new duplicates
 */
async function handleScan(
  db: D1Database, 
  body: MergeRequest, 
  userId: string, 
  corsHeaders: Record<string, string>
): Promise<Response> {
  const options = body.scanOptions || {};
  const runId = generateId().replace('dup_', 'run_');
  const batchId = generateId().replace('dup_', 'batch_');

  // Create run record
  await db.prepare(`
    INSERT INTO deduplication_runs (id, rule_ids, source_tables, triggered_by)
    VALUES (?, ?, ?, ?)
  `).bind(
    runId,
    JSON.stringify(options.ruleIds || []),
    JSON.stringify(options.tables || []),
    userId
  ).run();

  try {
    // Get active rules
    let rulesQuery = `SELECT * FROM entity_resolution_rules WHERE is_active = 1`;
    if (options.ruleIds?.length) {
      const placeholders = options.ruleIds.map(() => '?').join(',');
      rulesQuery += ` AND id IN (${placeholders})`;
    }
    rulesQuery += ` ORDER BY priority ASC`;

    const rules = options.ruleIds?.length 
      ? await db.prepare(rulesQuery).bind(...options.ruleIds).all()
      : await db.prepare(rulesQuery).all();

    let totalScanned = 0;
    let totalFound = 0;
    let autoMerged = 0;

    // Process each rule
    for (const rule of (rules.results || [])) {
      const matchFields = JSON.parse(rule.match_fields as string);
      const fieldWeights = rule.field_weights ? JSON.parse(rule.field_weights as string) : {};

      // Find potential matches based on rule
      const matches = await findMatches(
        db, 
        rule.source_table as string, 
        rule.target_table as string,
        matchFields,
        fieldWeights,
        rule.review_threshold as number,
        options.maxResults || 100
      );

      totalScanned += matches.scanned;

      // Process each match
      for (const match of matches.candidates) {
        // Check if this pair already exists
        const existing = await db.prepare(`
          SELECT id FROM duplicate_candidates 
          WHERE (entity1_table = ? AND entity1_id = ? AND entity2_table = ? AND entity2_id = ?)
             OR (entity1_table = ? AND entity1_id = ? AND entity2_table = ? AND entity2_id = ?)
        `).bind(
          match.entity1_table, match.entity1_id, match.entity2_table, match.entity2_id,
          match.entity2_table, match.entity2_id, match.entity1_table, match.entity1_id
        ).first();

        if (existing) continue;

        // Determine status based on confidence
        let status = 'pending';
        if (match.confidence >= (rule.auto_merge_threshold as number)) {
          status = 'confirmed';
          autoMerged++;
        }

        // Insert candidate
        await db.prepare(`
          INSERT INTO duplicate_candidates (
            id, entity1_table, entity1_id, entity2_table, entity2_id,
            rule_id, confidence_score, match_details, status, batch_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          generateId(),
          match.entity1_table,
          match.entity1_id,
          match.entity2_table,
          match.entity2_id,
          rule.id,
          match.confidence,
          JSON.stringify(match.details),
          status,
          batchId
        ).run();

        totalFound++;
      }
    }

    // Update run record
    await db.prepare(`
      UPDATE deduplication_runs 
      SET status = 'completed', completed_at = unixepoch(),
          records_scanned = ?, candidates_found = ?, auto_merged = ?,
          pending_review = ?, duration_seconds = unixepoch() - started_at
      WHERE id = ?
    `).bind(totalScanned, totalFound, autoMerged, totalFound - autoMerged, runId).run();

    return new Response(JSON.stringify({
      success: true,
      runId,
      batchId,
      results: {
        recordsScanned: totalScanned,
        candidatesFound: totalFound,
        autoConfirmed: autoMerged,
        pendingReview: totalFound - autoMerged
      }
    }), { headers: corsHeaders });

  } catch (error) {
    // Update run as failed
    await db.prepare(`
      UPDATE deduplication_runs 
      SET status = 'failed', completed_at = unixepoch(), error_message = ?
      WHERE id = ?
    `).bind(error instanceof Error ? error.message : 'Unknown error', runId).run();

    throw error;
  }
}

/**
 * Find matches between tables based on rule configuration
 */
async function findMatches(
  db: D1Database,
  sourceTable: string,
  targetTable: string,
  matchFields: string[],
  fieldWeights: Record<string, number>,
  threshold: number,
  maxResults: number
): Promise<{ scanned: number; candidates: Array<{
  entity1_table: string;
  entity1_id: string;
  entity2_table: string;
  entity2_id: string;
  confidence: number;
  details: Record<string, unknown>;
}> }> {
  const candidates: Array<{
    entity1_table: string;
    entity1_id: string;
    entity2_table: string;
    entity2_id: string;
    confidence: number;
    details: Record<string, unknown>;
  }> = [];

  // Field mapping for different tables
  const fieldMap: Record<string, Record<string, string>> = {
    restaurant_leads: { email: 'primary_email', phone: 'primary_phone', company_name: 'name', name: 'name', address: 'address_line1' },
    clients: { email: 'email', phone: 'phone', company_name: 'name', name: 'name' },
    org_contacts: { email: 'email', phone: 'phone', name: 'first_name || " " || last_name' },
    organizations: { company_name: 'legal_name', phone: 'phone', address: 'address_line1' },
    contact_submissions: { email: 'email', phone: 'phone', company_name: 'company', name: 'name' },
    synced_contacts: { email: 'email', phone: 'phone', name: 'name' }
  };

  const sourceFields = fieldMap[sourceTable] || {};
  const targetFields = fieldMap[targetTable] || {};

  // For email matching (most common and efficient)
  if (matchFields.includes('email')) {
    const sourceEmailField = sourceFields.email || 'email';
    const targetEmailField = targetFields.email || 'email';

    // Find exact email matches
    const query = `
      SELECT 
        s.id as source_id,
        t.id as target_id,
        s.${sourceEmailField} as source_email,
        t.${targetEmailField} as target_email
      FROM ${sourceTable} s
      INNER JOIN ${targetTable} t ON LOWER(TRIM(s.${sourceEmailField})) = LOWER(TRIM(t.${targetEmailField}))
      WHERE s.${sourceEmailField} IS NOT NULL 
        AND s.${sourceEmailField} != ''
        AND t.${targetEmailField} IS NOT NULL
        AND t.${targetEmailField} != ''
        ${sourceTable === targetTable ? 'AND s.id < t.id' : ''}
      LIMIT ?
    `;

    const matches = await db.prepare(query).bind(maxResults).all();
    
    for (const match of (matches.results || [])) {
      candidates.push({
        entity1_table: sourceTable,
        entity1_id: match.source_id as string,
        entity2_table: targetTable,
        entity2_id: match.target_id as string,
        confidence: fieldWeights.email || 1.0,
        details: {
          matchType: 'exact_email',
          email: match.source_email
        }
      });
    }
  }

  // For phone matching
  if (matchFields.includes('phone') && candidates.length < maxResults) {
    const sourcePhoneField = sourceFields.phone || 'phone';
    const targetPhoneField = targetFields.phone || 'phone';

    // Normalize phone (remove non-digits)
    const query = `
      SELECT 
        s.id as source_id,
        t.id as target_id,
        s.${sourcePhoneField} as source_phone,
        t.${targetPhoneField} as target_phone
      FROM ${sourceTable} s
      INNER JOIN ${targetTable} t ON 
        REPLACE(REPLACE(REPLACE(REPLACE(s.${sourcePhoneField}, '-', ''), '(', ''), ')', ''), ' ', '') = 
        REPLACE(REPLACE(REPLACE(REPLACE(t.${targetPhoneField}, '-', ''), '(', ''), ')', ''), ' ', '')
      WHERE s.${sourcePhoneField} IS NOT NULL 
        AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(s.${sourcePhoneField}, '-', ''), '(', ''), ')', ''), ' ', '')) >= 10
        AND t.${targetPhoneField} IS NOT NULL
        ${sourceTable === targetTable ? 'AND s.id < t.id' : ''}
      LIMIT ?
    `;

    try {
      const matches = await db.prepare(query).bind(maxResults - candidates.length).all();
      
      for (const match of (matches.results || [])) {
        // Check if this pair already added
        const exists = candidates.some(c => 
          (c.entity1_id === match.source_id && c.entity2_id === match.target_id) ||
          (c.entity1_id === match.target_id && c.entity2_id === match.source_id)
        );
        
        if (!exists) {
          candidates.push({
            entity1_table: sourceTable,
            entity1_id: match.source_id as string,
            entity2_table: targetTable,
            entity2_id: match.target_id as string,
            confidence: fieldWeights.phone || 0.8,
            details: {
              matchType: 'phone_match',
              phone: match.source_phone
            }
          });
        }
      }
    } catch (e) {
      console.log('Phone matching query failed:', e);
    }
  }

  // Get total records scanned
  const countResult = await db.prepare(
    `SELECT COUNT(*) as count FROM ${sourceTable}`
  ).first<{ count: number }>();

  return {
    scanned: countResult?.count || 0,
    candidates
  };
}
