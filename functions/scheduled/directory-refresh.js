/**
 * Scheduled Directory Refresh
 *
 * Runs at 5 AM and 5 PM daily to:
 * 1. Validate existing data
 * 2. Check for stale records
 * 3. Update data quality scores
 * 4. Log refresh results
 *
 * Configure in wrangler.toml:
 * [triggers]
 * crons = ["0 5 * * *", "0 17 * * *"]
 */

// Town to region mapping
const TOWN_REGION_MAP = {
  'Provincetown': 'Outer Cape',
  'Truro': 'Outer Cape',
  'Wellfleet': 'Outer Cape',
  'Eastham': 'Outer Cape',
  'Orleans': 'Lower Cape',
  'Chatham': 'Lower Cape',
  'Brewster': 'Lower Cape',
  'Harwich': 'Lower Cape',
  'Dennis': 'Mid Cape',
  'Yarmouth': 'Mid Cape',
  'Barnstable': 'Mid Cape',
  'Mashpee': 'Upper Cape',
  'Falmouth': 'Upper Cape',
  'Sandwich': 'Upper Cape',
  'Bourne': 'Upper Cape',
};

const VALID_TOWNS = Object.keys(TOWN_REGION_MAP);

export default {
  async scheduled(event, env, ctx) {
    const startTime = Date.now();
    const runId = 'refresh_' + Date.now().toString(36);

    console.log(`[${runId}] Starting directory refresh...`);

    const results = {
      run_id: runId,
      started_at: new Date().toISOString(),
      tasks: [],
      errors: [],
      summary: {
        total_records: 0,
        validated: 0,
        issues_found: 0,
        auto_fixed: 0,
        stale_records: 0,
      },
    };

    try {
      // Task 1: Count total records
      const countResult = await env.DB.prepare(`
        SELECT COUNT(*) as total FROM cape_cod_restaurants
      `).first();
      results.summary.total_records = countResult?.total || 0;
      results.tasks.push({ task: 'count_records', status: 'completed', count: results.summary.total_records });

      // Task 2: Validate all records
      const allRecords = await env.DB.prepare(`
        SELECT id, name, town, region, pos_system, updated_at
        FROM cape_cod_restaurants
      `).all();

      const issues = [];
      const autoFixes = [];

      for (const record of (allRecords.results || [])) {
        // Check: Town is valid
        if (!VALID_TOWNS.includes(record.town)) {
          issues.push({
            id: record.id,
            issue: 'invalid_town',
            message: `Invalid town: ${record.town}`,
          });
        }

        // Check: Region matches town
        if (record.town && TOWN_REGION_MAP[record.town] && record.region !== TOWN_REGION_MAP[record.town]) {
          // Auto-fix region
          await env.DB.prepare(`
            UPDATE cape_cod_restaurants SET region = ? WHERE id = ?
          `).bind(TOWN_REGION_MAP[record.town], record.id).run();

          autoFixes.push({
            id: record.id,
            fix: 'region_corrected',
            from: record.region,
            to: TOWN_REGION_MAP[record.town],
          });
        }

        // Check: Stale record (not updated in 90 days)
        if (record.updated_at) {
          const daysSinceUpdate = (Date.now() / 1000 - record.updated_at) / 86400;
          if (daysSinceUpdate > 90) {
            results.summary.stale_records++;
          }
        }
      }

      results.summary.validated = allRecords.results?.length || 0;
      results.summary.issues_found = issues.length;
      results.summary.auto_fixed = autoFixes.length;

      results.tasks.push({
        task: 'validate_records',
        status: 'completed',
        validated: results.summary.validated,
        issues: issues.length,
        auto_fixed: autoFixes.length,
      });

      if (issues.length > 0) {
        results.issues = issues.slice(0, 20); // Log first 20 issues
      }
      if (autoFixes.length > 0) {
        results.auto_fixes = autoFixes;
      }

      // Task 3: Update refresh schedule
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(`
        UPDATE data_refresh_schedule
        SET last_run_at = ?, next_run_at = ?
        WHERE refresh_type = 'full_directory' AND status = 'active'
      `).bind(now, now + 43200).run(); // Next run in 12 hours

      results.tasks.push({ task: 'update_schedule', status: 'completed' });

      // Task 4: Get stats by region
      const regionStats = await env.DB.prepare(`
        SELECT region, COUNT(*) as count
        FROM cape_cod_restaurants
        GROUP BY region
        ORDER BY region
      `).all();

      results.stats_by_region = Object.fromEntries(
        (regionStats.results || []).map(r => [r.region, r.count])
      );

      // Task 5: Get stats by POS system
      const posStats = await env.DB.prepare(`
        SELECT pos_system, COUNT(*) as count
        FROM cape_cod_restaurants
        WHERE pos_system IS NOT NULL
        GROUP BY pos_system
        ORDER BY count DESC
      `).all();

      results.stats_by_pos = Object.fromEntries(
        (posStats.results || []).map(r => [r.pos_system, r.count])
      );

      // Task 6: Check for duplicates
      const duplicates = await env.DB.prepare(`
        SELECT name, town, COUNT(*) as count
        FROM cape_cod_restaurants
        GROUP BY name, town
        HAVING count > 1
      `).all();

      if (duplicates.results && duplicates.results.length > 0) {
        results.potential_duplicates = duplicates.results;
        results.tasks.push({
          task: 'check_duplicates',
          status: 'warning',
          duplicates_found: duplicates.results.length,
        });
      } else {
        results.tasks.push({ task: 'check_duplicates', status: 'completed', duplicates_found: 0 });
      }

    } catch (error) {
      console.error(`[${runId}] Refresh error:`, error);
      results.errors.push({
        phase: 'execution',
        error: error.message,
        stack: error.stack,
      });
    }

    // Calculate duration
    results.duration_ms = Date.now() - startTime;
    results.completed_at = new Date().toISOString();

    console.log(`[${runId}] Directory refresh completed in ${results.duration_ms}ms`);
    console.log(`[${runId}] Summary:`, JSON.stringify(results.summary));

    // Log results to intelligence run logs if table exists
    try {
      await env.DB.prepare(`
        INSERT INTO intelligence_run_logs (id, agent_id, run_type, status, results_json, started_at, completed_at)
        VALUES (?, 'directory_refresh', 'scheduled', 'completed', ?, ?, ?)
      `).bind(
        runId,
        JSON.stringify(results),
        results.started_at,
        results.completed_at
      ).run();
    } catch (logError) {
      // Table might not exist - that's okay
      console.log(`[${runId}] Could not log to intelligence_run_logs:`, logError.message);
    }

    return results;
  },
};
