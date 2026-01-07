/**
 * Email Analytics API - Device/Client Statistics
 *
 * GET /api/admin/email/analytics/devices - Get device and client breakdown
 *
 * Query params:
 *   - sequence_id: Filter by sequence (optional)
 *   - start_date: Start date in YYYY-MM-DD format
 *   - end_date: End date in YYYY-MM-DD format
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);

    // Get query parameters
    const sequenceId = url.searchParams.get('sequence_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // Default to last 30 days
    const now = new Date();
    const defaultEnd = now.toISOString().split('T')[0];
    const defaultStart = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];

    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;

    // Convert dates to Unix timestamps
    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end + 'T23:59:59').getTime() / 1000);

    // Build base condition
    let baseCondition = 'created_at >= ? AND created_at <= ?';
    const params = [startTs, endTs];

    if (sequenceId) {
      baseCondition += ' AND sequence_id = ?';
      params.push(sequenceId);
    }

    // Query for device type breakdown (parsed from user_agent if available)
    const deviceQuery = `
      SELECT
        CASE
          WHEN user_agent LIKE '%Mobile%' OR user_agent LIKE '%Android%' OR user_agent LIKE '%iPhone%' THEN 'Mobile'
          WHEN user_agent LIKE '%Tablet%' OR user_agent LIKE '%iPad%' THEN 'Tablet'
          WHEN user_agent IS NULL OR user_agent = '' THEN 'Unknown'
          ELSE 'Desktop'
        END as device_type,
        COUNT(*) as opens,
        COUNT(DISTINCT subscriber_id) as unique_users
      FROM email_logs
      WHERE opened_at IS NOT NULL AND ${baseCondition}
      GROUP BY device_type
      ORDER BY opens DESC
    `;

    // Query for email client breakdown
    const clientQuery = `
      SELECT
        CASE
          WHEN user_agent LIKE '%Gmail%' THEN 'Gmail'
          WHEN user_agent LIKE '%Outlook%' OR user_agent LIKE '%Microsoft%' THEN 'Outlook'
          WHEN user_agent LIKE '%Apple Mail%' OR user_agent LIKE '%iPhone%' OR user_agent LIKE '%iPad%' THEN 'Apple Mail'
          WHEN user_agent LIKE '%Yahoo%' THEN 'Yahoo Mail'
          WHEN user_agent LIKE '%Thunderbird%' THEN 'Thunderbird'
          WHEN user_agent LIKE '%Chrome%' THEN 'Web (Chrome)'
          WHEN user_agent LIKE '%Safari%' AND user_agent NOT LIKE '%Chrome%' THEN 'Web (Safari)'
          WHEN user_agent LIKE '%Firefox%' THEN 'Web (Firefox)'
          WHEN user_agent IS NULL OR user_agent = '' THEN 'Unknown'
          ELSE 'Other'
        END as email_client,
        COUNT(*) as opens,
        COUNT(DISTINCT subscriber_id) as unique_users
      FROM email_logs
      WHERE opened_at IS NOT NULL AND ${baseCondition}
      GROUP BY email_client
      ORDER BY opens DESC
    `;

    // Query for OS breakdown
    const osQuery = `
      SELECT
        CASE
          WHEN user_agent LIKE '%Windows%' THEN 'Windows'
          WHEN user_agent LIKE '%Mac OS%' OR user_agent LIKE '%Macintosh%' THEN 'macOS'
          WHEN user_agent LIKE '%iPhone%' OR user_agent LIKE '%iPad%' THEN 'iOS'
          WHEN user_agent LIKE '%Android%' THEN 'Android'
          WHEN user_agent LIKE '%Linux%' THEN 'Linux'
          WHEN user_agent IS NULL OR user_agent = '' THEN 'Unknown'
          ELSE 'Other'
        END as os,
        COUNT(*) as opens,
        COUNT(DISTINCT subscriber_id) as unique_users
      FROM email_logs
      WHERE opened_at IS NOT NULL AND ${baseCondition}
      GROUP BY os
      ORDER BY opens DESC
    `;

    // Query for hourly open pattern by device
    const hourlyQuery = `
      SELECT
        CAST(strftime('%H', datetime(opened_at, 'unixepoch')) AS INTEGER) as hour,
        CASE
          WHEN user_agent LIKE '%Mobile%' OR user_agent LIKE '%Android%' OR user_agent LIKE '%iPhone%' THEN 'Mobile'
          ELSE 'Desktop'
        END as device_type,
        COUNT(*) as opens
      FROM email_logs
      WHERE opened_at IS NOT NULL AND ${baseCondition}
      GROUP BY hour, device_type
      ORDER BY hour ASC
    `;

    // Execute queries in parallel
    const [devices, clients, operatingSystems, hourlyPattern] = await Promise.all([
      db.prepare(deviceQuery).bind(...params).all(),
      db.prepare(clientQuery).bind(...params).all(),
      db.prepare(osQuery).bind(...params).all(),
      db.prepare(hourlyQuery).bind(...params).all()
    ]);

    // Get total opens for percentage calculation
    const totalQuery = `
      SELECT COUNT(*) as total FROM email_logs
      WHERE opened_at IS NOT NULL AND ${baseCondition}
    `;
    const totalResult = await db.prepare(totalQuery).bind(...params).first();
    const totalOpens = totalResult?.total || 0;

    // Process results
    const formatResults = (results) => (results.results || []).map(row => ({
      ...row,
      percentage: totalOpens > 0 ? (row.opens / totalOpens) * 100 : 0
    }));

    // Process hourly pattern into mobile vs desktop
    const hourlyData = { mobile: [], desktop: [] };
    for (let h = 0; h < 24; h++) {
      const mobileHour = (hourlyPattern.results || []).find(r => r.hour === h && r.device_type === 'Mobile');
      const desktopHour = (hourlyPattern.results || []).find(r => r.hour === h && r.device_type === 'Desktop');
      hourlyData.mobile.push({ hour: h, opens: mobileHour?.opens || 0 });
      hourlyData.desktop.push({ hour: h, opens: desktopHour?.opens || 0 });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        devices: formatResults(devices),
        email_clients: formatResults(clients),
        operating_systems: formatResults(operatingSystems),
        hourly_by_device: hourlyData,
        summary: {
          total_opens: totalOpens,
          mobile_percentage: (() => {
            const mobile = (devices.results || []).find(d => d.device_type === 'Mobile');
            return totalOpens > 0 && mobile ? (mobile.opens / totalOpens) * 100 : 0;
          })(),
          desktop_percentage: (() => {
            const desktop = (devices.results || []).find(d => d.device_type === 'Desktop');
            return totalOpens > 0 && desktop ? (desktop.opens / totalOpens) * 100 : 0;
          })()
        },
        meta: {
          start,
          end,
          sequence_id: sequenceId,
          note: 'Device data is extracted from user-agent strings when opens are tracked via pixel'
        }
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Device analytics error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
