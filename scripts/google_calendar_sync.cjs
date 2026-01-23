/**
 * Google Calendar -> Platform Sync
 * =================================
 * Reads upcoming and recent events from Google Calendar (business account),
 * classifies them as business vs personal, and pushes business events to
 * the platform's Context Engine and Business Brief.
 *
 * Usage: node scripts/google_calendar_sync.cjs [--days-back N] [--days-ahead N] [--dry-run] [--verbose]
 *
 * Designed to run periodically (cron or manual) for live calendar visibility.
 */

const fs = require('fs');
const https = require('https');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  tokenPath: 'D:\\MILLSTONE_STAGING\\google_creds\\tokens\\token_rg_business.json',
  syncEndpoint: 'https://ccrestaurantconsulting.com/api/context/sync',
  syncKey: 'CcGDXSQMnWlQnFKr2eovG2hkvrM1lHHpiFaAm-X8AdY',

  // Business calendar indicators
  businessKeywords: [
    'client', 'meeting', 'call', 'toast', 'restaurant', 'support',
    'onboarding', 'implementation', 'discovery', 'demo', 'audit',
    'network', 'cable', 'consulting', 'project', 'review',
    'guardian', 'invoice', 'quote', 'r&g', 'cape cod',
    'pos', 'menu', 'training', 'install', 'site visit'
  ],

  // Personal event indicators (skip these)
  personalKeywords: [
    'birthday', 'dentist', 'doctor', 'gym', 'workout',
    'personal', 'family', 'vacation', 'holiday'
  ],

  // Calendar IDs to include (primary + any business calendars)
  calendarIds: ['primary'],
};

// ============================================
// HTTP HELPERS
// ============================================
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ============================================
// OAUTH TOKEN MANAGEMENT
// ============================================
async function getAccessToken() {
  const tokenData = JSON.parse(fs.readFileSync(CONFIG.tokenPath, 'utf-8'));

  const expiry = new Date(tokenData.expiry);
  if (expiry.getTime() - Date.now() < 300000) {
    const params = new URLSearchParams({
      client_id: tokenData.client_id,
      client_secret: tokenData.client_secret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    });

    const response = await httpsRequest('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (response.status !== 200) {
      throw new Error(`Token refresh failed: ${JSON.stringify(response.data)}`);
    }

    tokenData.token = response.data.access_token;
    tokenData.expiry = new Date(Date.now() + response.data.expires_in * 1000).toISOString();
    fs.writeFileSync(CONFIG.tokenPath, JSON.stringify(tokenData));
  }

  return tokenData.token;
}

// ============================================
// GOOGLE CALENDAR API
// ============================================
async function calendarApi(endpoint, accessToken) {
  const url = `https://www.googleapis.com/calendar/v3/${endpoint}`;
  const response = await httpsRequest(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (response.status !== 200) {
    throw new Error(`Calendar API (${response.status}): ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

async function getEvents(calendarId, timeMin, timeMax, accessToken) {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });

  return await calendarApi(
    `calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    accessToken
  );
}

// ============================================
// EVENT CLASSIFICATION
// ============================================
function classifyEvent(event) {
  const title = (event.summary || '').toLowerCase();
  const description = (event.description || '').toLowerCase();
  const location = (event.location || '').toLowerCase();
  const combined = `${title} ${description} ${location}`;

  // Check for personal indicators first
  if (CONFIG.personalKeywords.some(kw => combined.includes(kw))) {
    return { type: 'personal', confidence: 'high' };
  }

  // Check for business indicators
  if (CONFIG.businessKeywords.some(kw => combined.includes(kw))) {
    return { type: 'business', confidence: 'high' };
  }

  // Events with attendees from business domains are business
  const attendees = event.attendees || [];
  const hasBusinessAttendee = attendees.some(a => {
    const email = (a.email || '').toLowerCase();
    return email.includes('ccrestaurantconsulting') ||
           email.includes('ramirezconsulting') ||
           !email.includes('gmail.com') && !email.includes('yahoo.com') &&
           !email.includes('hotmail.com') && email.includes('.');
  });
  if (hasBusinessAttendee && attendees.length > 1) {
    return { type: 'business', confidence: 'medium' };
  }

  // Events with video conferencing links are likely meetings
  if (event.hangoutLink || event.conferenceData) {
    return { type: 'business', confidence: 'low' };
  }

  // Default: unclassified
  return { type: 'unclassified', confidence: 'low' };
}

// ============================================
// SYNC TO PLATFORM
// ============================================
async function syncToContext(items) {
  if (items.length === 0) return { processed: 0 };

  const payload = {
    batch_id: `gcal_sync_${Date.now()}`,
    source: 'google_calendar',
    items: items,
  };

  const response = await httpsRequest(CONFIG.syncEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': CONFIG.syncKey,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 200) {
    return response.data?.results || { processed: items.length };
  } else {
    console.error(`  [Sync Error] HTTP ${response.status}: ${JSON.stringify(response.data)}`);
    return { processed: 0, error: response.status };
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  const daysBackIdx = args.indexOf('--days-back');
  const daysBack = daysBackIdx >= 0 ? parseInt(args[daysBackIdx + 1]) : 7;

  const daysAheadIdx = args.indexOf('--days-ahead');
  const daysAhead = daysAheadIdx >= 0 ? parseInt(args[daysAheadIdx + 1]) : 14;

  const timeMin = new Date(Date.now() - daysBack * 86400000);
  const timeMax = new Date(Date.now() + daysAhead * 86400000);

  console.log('==========================================');
  console.log('GOOGLE CALENDAR -> PLATFORM SYNC');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Window: ${daysBack} days back, ${daysAhead} days ahead`);
  console.log(`Range: ${timeMin.toISOString().slice(0, 10)} to ${timeMax.toISOString().slice(0, 10)}`);
  console.log('==========================================\n');

  const accessToken = await getAccessToken();
  console.log('[Auth] Google Calendar authenticated.\n');

  const stats = { business: 0, personal: 0, unclassified: 0, total: 0 };
  const contextItems = [];

  for (const calendarId of CONFIG.calendarIds) {
    console.log(`[Calendar] Fetching events from: ${calendarId}`);

    try {
      const result = await getEvents(calendarId, timeMin, timeMax, accessToken);
      const events = result.items || [];
      console.log(`  Found ${events.length} events in window.\n`);
      stats.total += events.length;

      for (const event of events) {
        const classification = classifyEvent(event);
        stats[classification.type] = (stats[classification.type] || 0) + 1;

        if (verbose) {
          const start = event.start?.dateTime || event.start?.date || '?';
          console.log(`  [${classification.type}] ${start.slice(0, 16)} - ${(event.summary || '(untitled)').substring(0, 50)}`);
        }

        // Only sync business events
        if (classification.type !== 'business') continue;

        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;
        const startTs = startTime ? Math.floor(new Date(startTime).getTime() / 1000) : null;

        // Calculate duration
        let durationMin = null;
        if (startTime && endTime) {
          durationMin = Math.round((new Date(endTime) - new Date(startTime)) / 60000);
        }

        let summary = event.summary || 'Calendar Event';
        if (durationMin) summary += ` (${durationMin}min)`;

        // Build attendee list for snippet
        const attendeeList = (event.attendees || [])
          .map(a => a.displayName || a.email)
          .filter(Boolean)
          .slice(0, 5)
          .join(', ');

        const snippet = [
          event.description ? event.description.substring(0, 300) : '',
          event.location ? `Location: ${event.location}` : '',
          attendeeList ? `Attendees: ${attendeeList}` : '',
        ].filter(Boolean).join('\n').substring(0, 500);

        contextItems.push({
          id: `gcal_${event.id}`,
          entity_type: 'meeting',
          direction: 'both',
          summary: summary.substring(0, 300),
          content_snippet: snippet,
          occurred_at: startTs,
          source_id: event.id,
          privacy_level: 'business',
          data_tag: 'calendar',
        });
      }
    } catch (err) {
      console.error(`  [Error] ${calendarId}: ${err.message}`);
    }
  }

  // Sync to platform
  if (!dryRun && contextItems.length > 0) {
    console.log(`\n[Sync] Pushing ${contextItems.length} business events to platform...`);
    const result = await syncToContext(contextItems);
    console.log(`  Processed: ${result.processed || 0}`);
  }

  // Summary
  console.log('\n==========================================');
  console.log('CALENDAR SYNC RESULTS');
  console.log('==========================================');
  console.log(`  Total events:     ${stats.total}`);
  console.log(`  Business:         ${stats.business}`);
  console.log(`  Personal:         ${stats.personal}`);
  console.log(`  Unclassified:     ${stats.unclassified}`);
  console.log(`  Synced to platform: ${contextItems.length}`);
  console.log('==========================================\n');

  if (dryRun) {
    console.log('[DRY RUN] No changes made.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
