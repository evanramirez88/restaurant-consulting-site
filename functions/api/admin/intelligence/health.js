/**
 * Intelligence Aggregation Health Check API
 *
 * GET /api/admin/intelligence/health
 *
 * Returns comprehensive health status for the data aggregation pipeline:
 * - Last aggregation time
 * - Number of items aggregated
 * - Source health status
 * - Context items stats
 * - Intelligence feed stats
 */

import { verifyAuth, unauthorizedResponse, handleOptions } from '../../../_shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;
  const oneWeekAgo = now - 604800;

  try {
    // Get latest aggregator run
    const latestRun = await env.DB.prepare(`
      SELECT
        id,
        run_started_at,
        run_completed_at,
        sources_processed,
        items_fetched,
        items_imported,
        items_duplicated,
        items_failed,
        errors_json,
        status
      FROM toast_hub_aggregator_logs
      ORDER BY run_started_at DESC
      LIMIT 1
    `).first();

    // Get source health
    const sourceHealth = await env.DB.prepare(`
      SELECT
        id,
        name,
        source_type,
        feed_url,
        is_active,
        last_fetched_at,
        consecutive_failures,
        last_error
      FROM toast_hub_sources
      ORDER BY is_active DESC, consecutive_failures ASC
    `).all();

    // Calculate source status
    const sources = (sourceHealth.results || []).map(source => {
      let status = 'healthy';
      let statusColor = 'green';

      if (!source.is_active) {
        status = 'disabled';
        statusColor = 'gray';
      } else if (source.consecutive_failures >= 5) {
        status = 'critical';
        statusColor = 'red';
      } else if (source.consecutive_failures >= 3) {
        status = 'warning';
        statusColor = 'yellow';
      } else if (!source.last_fetched_at || source.last_fetched_at < oneWeekAgo) {
        status = 'stale';
        statusColor = 'orange';
      }

      return {
        ...source,
        status,
        statusColor,
        lastFetchedAgo: source.last_fetched_at
          ? formatTimeAgo(now - source.last_fetched_at)
          : 'never'
      };
    });

    // Get toast_hub_imports stats
    const importsStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) as this_week,
        AVG(ai_score) as avg_score
      FROM toast_hub_imports
    `).bind(oneDayAgo, oneWeekAgo).first();

    // Get context_items stats
    const contextStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) as this_week,
        COUNT(DISTINCT source_id) as unique_sources,
        AVG(relevance_score) as avg_relevance
      FROM context_items
    `).bind(oneDayAgo, oneWeekAgo).first();

    // Get intel_feed_items stats
    const feedStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN triage_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN triage_status = 'relevant' THEN 1 ELSE 0 END) as relevant,
        SUM(CASE WHEN triage_status = 'irrelevant' THEN 1 ELSE 0 END) as irrelevant,
        SUM(CASE WHEN converted_to_finding = 1 THEN 1 ELSE 0 END) as converted,
        AVG(relevance_score) as avg_relevance
      FROM intel_feed_items
    `).first();

    // Get context_data_sources sync status
    const contextSources = await env.DB.prepare(`
      SELECT
        id,
        name,
        source_type,
        sync_enabled,
        last_sync_at,
        last_sync_status,
        last_sync_count
      FROM context_data_sources
      WHERE sync_enabled = 1 OR last_sync_at IS NOT NULL
      ORDER BY last_sync_at DESC NULLS LAST
    `).all();

    // Calculate overall health
    const healthScore = calculateHealthScore({
      latestRun,
      sources,
      importsStats,
      contextStats,
      now
    });

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      health: {
        score: healthScore.score,
        status: healthScore.status,
        issues: healthScore.issues
      },
      aggregation: {
        lastRun: latestRun ? {
          startedAt: new Date(latestRun.run_started_at * 1000).toISOString(),
          completedAt: latestRun.run_completed_at
            ? new Date(latestRun.run_completed_at * 1000).toISOString()
            : null,
          ago: formatTimeAgo(now - latestRun.run_started_at),
          sourcesProcessed: latestRun.sources_processed,
          itemsFetched: latestRun.items_fetched,
          itemsImported: latestRun.items_imported,
          itemsDuplicated: latestRun.items_duplicated,
          itemsFailed: latestRun.items_failed,
          status: latestRun.status,
          errors: latestRun.errors_json ? JSON.parse(latestRun.errors_json) : []
        } : null,
        workerUrl: 'https://toast-hub-aggregator.ramirezconsulting-rg.workers.dev'
      },
      sources: {
        total: sources.length,
        active: sources.filter(s => s.is_active).length,
        healthy: sources.filter(s => s.status === 'healthy').length,
        warning: sources.filter(s => s.status === 'warning').length,
        critical: sources.filter(s => s.status === 'critical').length,
        details: sources
      },
      imports: {
        total: importsStats?.total || 0,
        pending: importsStats?.pending || 0,
        approved: importsStats?.approved || 0,
        rejected: importsStats?.rejected || 0,
        today: importsStats?.today || 0,
        thisWeek: importsStats?.this_week || 0,
        avgScore: Math.round(importsStats?.avg_score || 0)
      },
      context: {
        total: contextStats?.total || 0,
        today: contextStats?.today || 0,
        thisWeek: contextStats?.this_week || 0,
        uniqueSources: contextStats?.unique_sources || 0,
        avgRelevance: Math.round((contextStats?.avg_relevance || 0) * 100) / 100,
        sources: contextSources.results || []
      },
      feed: {
        total: feedStats?.total || 0,
        pending: feedStats?.pending || 0,
        relevant: feedStats?.relevant || 0,
        irrelevant: feedStats?.irrelevant || 0,
        converted: feedStats?.converted || 0,
        avgRelevance: Math.round(feedStats?.avg_relevance || 0)
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Health check error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      health: {
        score: 0,
        status: 'error',
        issues: ['Health check failed: ' + error.message]
      }
    }), { status: 500, headers: corsHeaders });
  }
}

function formatTimeAgo(seconds) {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function calculateHealthScore({ latestRun, sources, importsStats, contextStats, now }) {
  let score = 100;
  const issues = [];

  // Check last aggregation run (30 points)
  if (!latestRun) {
    score -= 30;
    issues.push('No aggregation runs recorded');
  } else {
    const hoursSinceRun = (now - latestRun.run_started_at) / 3600;
    if (hoursSinceRun > 24) {
      score -= 20;
      issues.push(`Last aggregation was ${Math.floor(hoursSinceRun)} hours ago`);
    } else if (hoursSinceRun > 12) {
      score -= 10;
      issues.push(`Last aggregation was ${Math.floor(hoursSinceRun)} hours ago`);
    }

    if (latestRun.status === 'failed') {
      score -= 15;
      issues.push('Last aggregation run failed');
    }

    if (latestRun.items_failed > 0) {
      score -= 5;
      issues.push(`${latestRun.items_failed} items failed in last run`);
    }
  }

  // Check source health (30 points)
  const activeSources = sources.filter(s => s.is_active);
  const criticalSources = sources.filter(s => s.status === 'critical');
  const warningSources = sources.filter(s => s.status === 'warning');

  if (activeSources.length === 0) {
    score -= 30;
    issues.push('No active data sources');
  } else {
    if (criticalSources.length > 0) {
      score -= criticalSources.length * 5;
      issues.push(`${criticalSources.length} source(s) in critical state`);
    }
    if (warningSources.length > 0) {
      score -= warningSources.length * 2;
      issues.push(`${warningSources.length} source(s) with warnings`);
    }
  }

  // Check content availability (20 points)
  if (!importsStats?.total || importsStats.total === 0) {
    score -= 20;
    issues.push('No imported content available');
  } else if (importsStats.today === 0 && importsStats.this_week < 10) {
    score -= 10;
    issues.push('Very little new content this week');
  }

  // Check context availability (20 points)
  if (!contextStats?.total || contextStats.total === 0) {
    score -= 20;
    issues.push('No context items for RAG queries');
  } else if (contextStats.total < 100) {
    score -= 10;
    issues.push('Limited context items available (<100)');
  }

  // Determine status
  let status = 'healthy';
  if (score < 50) status = 'critical';
  else if (score < 70) status = 'degraded';
  else if (score < 90) status = 'warning';

  return { score: Math.max(0, score), status, issues };
}
