/**
 * Gmail Check Script
 * Reads recent sent emails and inbox activity from the RG business account.
 * Uses OAuth2 refresh token flow.
 *
 * Usage: node scripts/gmail_check.cjs [--sent] [--inbox] [--replies] [--days N]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN_PATH = 'D:\\MILLSTONE_STAGING\\google_creds\\tokens\\token_rg_business.json';

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

async function refreshAccessToken(tokenData) {
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

  // Update stored token
  tokenData.token = response.data.access_token;
  tokenData.expiry = new Date(Date.now() + response.data.expires_in * 1000).toISOString();
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData));

  return tokenData.token;
}

async function getAccessToken() {
  const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));

  // Check if token is expired (with 5 min buffer)
  const expiry = new Date(tokenData.expiry);
  if (expiry.getTime() - Date.now() < 300000) {
    console.log('[Gmail] Refreshing expired token...');
    return await refreshAccessToken(tokenData);
  }

  return tokenData.token;
}

async function gmailApi(endpoint, accessToken) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`;
  const response = await httpsRequest(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (response.status !== 200) {
    throw new Error(`Gmail API error (${response.status}): ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

async function getMessageDetails(messageId, accessToken) {
  const msg = await gmailApi(`messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Date`, accessToken);

  const headers = {};
  (msg.payload?.headers || []).forEach(h => {
    headers[h.name.toLowerCase()] = h.value;
  });

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: headers.subject || '(no subject)',
    to: headers.to || '',
    from: headers.from || '',
    date: headers.date || '',
    snippet: msg.snippet || '',
    labelIds: msg.labelIds || [],
  };
}

async function main() {
  const args = process.argv.slice(2);
  const showSent = args.includes('--sent') || (!args.includes('--inbox') && !args.includes('--replies'));
  const showInbox = args.includes('--inbox');
  const showReplies = args.includes('--replies');
  const daysArg = args.indexOf('--days');
  const days = daysArg >= 0 ? parseInt(args[daysArg + 1]) : 2;

  const afterDate = new Date(Date.now() - days * 86400000);
  const afterStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, '0')}/${String(afterDate.getDate()).padStart(2, '0')}`;

  console.log('==========================================');
  console.log('GMAIL CHECK - R&G Business Account');
  console.log(`Period: Last ${days} days (after ${afterStr})`);
  console.log('==========================================\n');

  const accessToken = await getAccessToken();
  console.log('[Gmail] Authenticated successfully.\n');

  // Check SENT emails
  if (showSent) {
    console.log('--- SENT EMAILS ---');
    try {
      const sentList = await gmailApi(`messages?q=in:sent after:${afterStr}&maxResults=20`, accessToken);
      const messages = sentList.messages || [];
      console.log(`Found ${sentList.resultSizeEstimate || 0} sent messages\n`);

      for (const msg of messages.slice(0, 15)) {
        const details = await getMessageDetails(msg.id, accessToken);
        const toShort = details.to.length > 50 ? details.to.substring(0, 50) + '...' : details.to;
        console.log(`  ${details.date}`);
        console.log(`  To: ${toShort}`);
        console.log(`  Subject: ${details.subject}`);
        console.log(`  Preview: ${details.snippet.substring(0, 80)}...`);
        console.log('');
      }
    } catch (e) {
      console.error(`  Error: ${e.message}`);
    }
  }

  // Check INBOX (new messages)
  if (showInbox) {
    console.log('--- INBOX (Recent) ---');
    try {
      const inboxList = await gmailApi(`messages?q=in:inbox after:${afterStr}&maxResults=15`, accessToken);
      const messages = inboxList.messages || [];
      console.log(`Found ${inboxList.resultSizeEstimate || 0} inbox messages\n`);

      for (const msg of messages.slice(0, 10)) {
        const details = await getMessageDetails(msg.id, accessToken);
        console.log(`  ${details.date}`);
        console.log(`  From: ${details.from}`);
        console.log(`  Subject: ${details.subject}`);
        console.log(`  Preview: ${details.snippet.substring(0, 80)}...`);
        console.log('');
      }
    } catch (e) {
      console.error(`  Error: ${e.message}`);
    }
  }

  // Check REPLIES to our sent emails (threads with responses)
  if (showReplies) {
    console.log('--- REPLIES TO OUTREACH ---');
    try {
      // Look for threads in inbox that also have sent messages
      const replyList = await gmailApi(`messages?q=in:inbox is:reply after:${afterStr}&maxResults=10`, accessToken);
      const messages = replyList.messages || [];
      console.log(`Found ${replyList.resultSizeEstimate || 0} potential replies\n`);

      for (const msg of messages.slice(0, 10)) {
        const details = await getMessageDetails(msg.id, accessToken);
        console.log(`  ${details.date}`);
        console.log(`  From: ${details.from}`);
        console.log(`  Subject: ${details.subject}`);
        console.log(`  Preview: ${details.snippet.substring(0, 80)}...`);
        console.log('');
      }
    } catch (e) {
      console.error(`  Error: ${e.message}`);
    }
  }

  // Summary stats
  console.log('--- LABEL STATS ---');
  try {
    const labels = await gmailApi('labels', accessToken);
    const interestingLabels = ['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD'];
    for (const label of (labels.labels || [])) {
      if (interestingLabels.includes(label.id)) {
        const detail = await gmailApi(`labels/${label.id}`, accessToken);
        console.log(`  ${label.name}: ${detail.messagesTotal || 0} total, ${detail.messagesUnread || 0} unread`);
      }
    }
  } catch (e) {
    console.error(`  Error: ${e.message}`);
  }

  console.log('\n==========================================');
  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
