/**
 * Email Inbound Worker
 *
 * Cloudflare Worker that handles inbound emails via Resend webhook.
 * Processes incoming emails with AI classification and routes them
 * to appropriate business logic handlers.
 *
 * Architecture:
 * - Receives POST requests from Resend inbound webhook
 * - Parses email content, headers, and attachments
 * - Uses Cloudflare AI to classify email intent
 * - Routes to handlers: positive response, negative/unsubscribe, menu attachment, general inquiry
 * - Stores emails in D1 and attachments in R2
 */

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2_BUCKET: R2Bucket;
  AI: Ai;
  RESEND_INBOUND_WEBHOOK_SECRET: string;
  WORKER_API_KEY: string;
  ENVIRONMENT: string;
  ALLOWED_TO_ADDRESSES: string;
}

// ============================================
// TYPE DEFINITIONS
// ============================================

interface ResendInboundEmail {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  reply_to?: string;
  headers?: Record<string, string>;
  attachments?: ResendAttachment[];
  // Additional fields from Resend
  created_at?: string;
  email_id?: string;
}

interface ResendAttachment {
  filename: string;
  content: string; // Base64 encoded
  content_type: string;
  size?: number;
}

interface EmailClassification {
  intent: 'positive_response' | 'negative_response' | 'unsubscribe' | 'menu_attachment' | 'general_inquiry' | 'out_of_office' | 'spam';
  confidence: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  hasMenuAttachment: boolean;
  isReply: boolean;
  suggestedPriority: 'high' | 'medium' | 'low';
  extractedData?: {
    restaurantName?: string;
    contactName?: string;
    phoneNumber?: string;
    interestLevel?: string;
    requestedService?: string;
  };
}

interface StoredInboundEmail {
  id: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  cc_email: string | null;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  headers_json: string | null;
  classification: string;
  confidence: number;
  sentiment: string;
  summary: string | null;
  is_reply: number;
  original_email_id: string | null;
  subscriber_id: string | null;
  lead_id: string | null;
  has_attachments: number;
  attachment_count: number;
  attachments_json: string | null;
  status: string;
  processed_at: number | null;
  created_at: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

function parseEmailAddress(email: string): { email: string; name: string | null } {
  // Parse "Name <email@domain.com>" or just "email@domain.com"
  const match = email.match(/^(?:(.+?)\s*<)?([^<>]+@[^<>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2].trim().toLowerCase(),
    };
  }
  return { name: null, email: email.toLowerCase() };
}

function extractReplyHeaders(headers: Record<string, string> | undefined): {
  inReplyTo: string | null;
  references: string[];
} {
  if (!headers) return { inReplyTo: null, references: [] };

  const inReplyTo = headers['In-Reply-To'] || headers['in-reply-to'] || null;
  const referencesRaw = headers['References'] || headers['references'] || '';
  const references = referencesRaw.split(/\s+/).filter(Boolean);

  return { inReplyTo, references };
}

function isMenuAttachment(attachment: ResendAttachment): boolean {
  const menuKeywords = ['menu', 'prix', 'carte', 'food', 'drink', 'beverage', 'wine', 'cocktail', 'brunch', 'dinner', 'lunch'];
  const filename = attachment.filename.toLowerCase();
  const contentType = attachment.content_type.toLowerCase();

  // Check if it's a document/image type
  const isDocument = contentType.includes('pdf') ||
    contentType.includes('image') ||
    contentType.includes('word') ||
    contentType.includes('excel') ||
    contentType.includes('spreadsheet');

  // Check filename for menu keywords
  const hasMenuKeyword = menuKeywords.some(kw => filename.includes(kw));

  return isDocument && (hasMenuKeyword || filename.includes('.pdf') || contentType.includes('image'));
}

// ============================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================

async function verifyResendWebhook(
  request: Request,
  secret: string | undefined
): Promise<{ valid: boolean; body: string; error?: string }> {
  const rawBody = await request.text();

  if (!secret) {
    console.warn('[Inbound] No webhook secret configured, skipping verification');
    return { valid: true, body: rawBody };
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valid: false, body: rawBody, error: 'Missing svix headers' };
  }

  // Check timestamp (5 minute tolerance)
  const timestampSeconds = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSeconds) > 300) {
    return { valid: false, body: rawBody, error: 'Timestamp out of tolerance' };
  }

  try {
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const secretBytes = Uint8Array.from(atob(secretKey), c => c.charCodeAt(0));

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent));
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    const signatures = svixSignature.split(' ');
    for (const sig of signatures) {
      const [version, sigValue] = sig.split(',');
      if (version === 'v1' && sigValue === expectedSig) {
        return { valid: true, body: rawBody };
      }
    }

    return { valid: false, body: rawBody, error: 'Signature mismatch' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, body: rawBody, error: errorMessage };
  }
}

// ============================================
// AI CLASSIFICATION
// ============================================

async function classifyEmail(
  env: Env,
  subject: string,
  bodyText: string | null,
  hasAttachments: boolean,
  attachmentFilenames: string[]
): Promise<EmailClassification> {
  const systemPrompt = `You are an email classifier for R&G Consulting, a restaurant technology consulting company specializing in Toast POS systems.

Classify the incoming email into one of these categories:
- positive_response: The sender is interested in services, wants to schedule a call, has questions about offerings
- negative_response: The sender explicitly declines, says not interested, asks to stop contact
- unsubscribe: The sender wants to unsubscribe from emails
- menu_attachment: The email contains or references a restaurant menu attachment
- general_inquiry: General business questions not directly about purchasing services
- out_of_office: Automated out-of-office or vacation reply
- spam: Spam, promotional, or irrelevant email

Also extract:
- Sentiment (positive/neutral/negative)
- Brief summary (1 sentence)
- Any extracted data: restaurant name, contact name, phone number, interest level, requested service
- Priority: high (interested lead), medium (general inquiry), low (out of office, spam)

Respond in JSON format only.`;

  const userPrompt = `Subject: ${subject}

Body:
${bodyText?.substring(0, 2000) || '(no text body)'}

Has attachments: ${hasAttachments}
Attachment filenames: ${attachmentFilenames.join(', ') || 'none'}`;

  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 500,
    });

    // Parse AI response
    const responseText = (response as { response: string }).response || '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        intent: parsed.intent || parsed.classification || 'general_inquiry',
        confidence: parsed.confidence || 0.7,
        sentiment: parsed.sentiment || 'neutral',
        summary: parsed.summary || 'Email received',
        hasMenuAttachment: parsed.hasMenuAttachment || hasAttachments,
        isReply: subject.toLowerCase().startsWith('re:'),
        suggestedPriority: parsed.priority || 'medium',
        extractedData: parsed.extractedData || parsed.extracted_data,
      };
    } catch {
      // Fallback classification if JSON parsing fails
      console.warn('[Inbound] AI response JSON parsing failed, using fallback');
      return getFallbackClassification(subject, bodyText, hasAttachments);
    }
  } catch (error) {
    console.error('[Inbound] AI classification error:', error);
    return getFallbackClassification(subject, bodyText, hasAttachments);
  }
}

function getFallbackClassification(
  subject: string,
  bodyText: string | null,
  hasAttachments: boolean
): EmailClassification {
  const subjectLower = subject.toLowerCase();
  const bodyLower = (bodyText || '').toLowerCase();
  const combined = subjectLower + ' ' + bodyLower;

  // Simple keyword-based classification
  if (combined.includes('unsubscribe') || combined.includes('remove me') || combined.includes('stop emailing')) {
    return { intent: 'unsubscribe', confidence: 0.8, sentiment: 'negative', summary: 'Unsubscribe request', hasMenuAttachment: false, isReply: false, suggestedPriority: 'high' };
  }

  if (combined.includes('not interested') || combined.includes('no thanks') || combined.includes('please remove')) {
    return { intent: 'negative_response', confidence: 0.7, sentiment: 'negative', summary: 'Declined interest', hasMenuAttachment: false, isReply: false, suggestedPriority: 'low' };
  }

  if (combined.includes('out of office') || combined.includes('auto-reply') || combined.includes('on vacation')) {
    return { intent: 'out_of_office', confidence: 0.9, sentiment: 'neutral', summary: 'Out of office reply', hasMenuAttachment: false, isReply: false, suggestedPriority: 'low' };
  }

  if (combined.includes('interested') || combined.includes('tell me more') || combined.includes('schedule') || combined.includes('call me')) {
    return { intent: 'positive_response', confidence: 0.7, sentiment: 'positive', summary: 'Expressed interest', hasMenuAttachment: hasAttachments, isReply: subjectLower.startsWith('re:'), suggestedPriority: 'high' };
  }

  if (hasAttachments && (combined.includes('menu') || combined.includes('attached'))) {
    return { intent: 'menu_attachment', confidence: 0.7, sentiment: 'neutral', summary: 'Menu attachment received', hasMenuAttachment: true, isReply: false, suggestedPriority: 'medium' };
  }

  return { intent: 'general_inquiry', confidence: 0.5, sentiment: 'neutral', summary: 'General email received', hasMenuAttachment: hasAttachments, isReply: subjectLower.startsWith('re:'), suggestedPriority: 'medium' };
}

// ============================================
// ATTACHMENT HANDLERS
// ============================================

async function storeAttachment(
  env: Env,
  emailId: string,
  attachment: ResendAttachment,
  index: number
): Promise<{ key: string; url: string }> {
  const timestamp = Date.now();
  const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `inbound-emails/${emailId}/${index}_${sanitizedFilename}`;

  // Decode base64 content
  const binaryData = Uint8Array.from(atob(attachment.content), c => c.charCodeAt(0));

  await env.R2_BUCKET.put(key, binaryData, {
    httpMetadata: {
      contentType: attachment.content_type,
    },
    customMetadata: {
      emailId,
      originalFilename: attachment.filename,
      uploadedAt: timestamp.toString(),
    },
  });

  return {
    key,
    url: `https://ccrc-uploads.r2.cloudflarestorage.com/${key}`,
  };
}

// ============================================
// BUSINESS LOGIC HANDLERS
// ============================================

async function handlePositiveResponse(
  env: Env,
  emailId: string,
  fromEmail: string,
  classification: EmailClassification,
  now: number
): Promise<void> {
  console.log(`[Inbound] Processing positive response from: ${fromEmail}`);

  // Find matching subscriber/lead
  const subscriber = await env.DB.prepare(`
    SELECT id, lead_id, first_name, last_name, company
    FROM email_subscribers
    WHERE email = ?
    LIMIT 1
  `).bind(fromEmail).first<{ id: string; lead_id: string | null; first_name: string; last_name: string; company: string }>();

  if (subscriber) {
    // Update subscriber engagement
    await env.DB.prepare(`
      UPDATE email_subscribers
      SET engagement_score = MIN(100, COALESCE(engagement_score, 0) + 25),
          last_replied_at = ?,
          reply_count = COALESCE(reply_count, 0) + 1,
          updated_at = ?
      WHERE id = ?
    `).bind(now, now, subscriber.id).run();

    // Update inbound email with subscriber link
    await env.DB.prepare(`
      UPDATE inbound_emails
      SET subscriber_id = ?, lead_id = ?
      WHERE id = ?
    `).bind(subscriber.id, subscriber.lead_id, emailId).run();
  }

  // Find matching restaurant lead
  const lead = await env.DB.prepare(`
    SELECT id, restaurant_name, status, score
    FROM restaurant_leads
    WHERE contact_email = ?
    LIMIT 1
  `).bind(fromEmail).first<{ id: string; restaurant_name: string; status: string; score: number }>();

  if (lead) {
    // Update lead status to interested
    await env.DB.prepare(`
      UPDATE restaurant_leads
      SET status = 'interested',
          score = MIN(100, COALESCE(score, 0) + 20),
          last_contact_at = ?,
          notes = COALESCE(notes, '') || '\n[' || datetime(?, 'unixepoch') || '] Positive email reply received.',
          updated_at = ?
      WHERE id = ?
    `).bind(now, now, now, lead.id).run();

    // Update inbound email with lead link
    await env.DB.prepare(`
      UPDATE inbound_emails SET lead_id = ? WHERE id = ?
    `).bind(lead.id, emailId).run();

    // Create follow-up task
    await createTask(env, {
      type: 'follow_up',
      title: `Follow up: ${lead.restaurant_name} replied positively`,
      description: `${fromEmail} replied with interest. Summary: ${classification.summary}`,
      priority: 'high',
      relatedId: lead.id,
      relatedType: 'lead',
      dueAt: now + (24 * 60 * 60), // Due in 24 hours
    }, now);
  }
}

async function handleNegativeResponse(
  env: Env,
  emailId: string,
  fromEmail: string,
  isUnsubscribe: boolean,
  now: number
): Promise<void> {
  console.log(`[Inbound] Processing ${isUnsubscribe ? 'unsubscribe' : 'negative response'} from: ${fromEmail}`);

  // Update subscriber status
  await env.DB.prepare(`
    UPDATE email_subscribers
    SET status = ?,
        ${isUnsubscribe ? 'unsubscribed_at = ?,' : ''}
        unsubscribe_reason = ?,
        updated_at = ?
    WHERE email = ?
  `).bind(
    isUnsubscribe ? 'unsubscribed' : 'declined',
    ...(isUnsubscribe ? [now] : []),
    isUnsubscribe ? 'email_reply_unsubscribe' : 'email_reply_declined',
    now,
    fromEmail
  ).run();

  // Cancel active sequences
  await env.DB.prepare(`
    UPDATE subscriber_sequences
    SET status = 'cancelled',
        cancelled_at = ?,
        cancel_reason = ?,
        updated_at = ?
    WHERE subscriber_id IN (SELECT id FROM email_subscribers WHERE email = ?)
      AND status IN ('active', 'queued', 'paused')
  `).bind(
    now,
    isUnsubscribe ? 'Unsubscribed via email reply' : 'Declined via email reply',
    now,
    fromEmail
  ).run();

  // Update lead status if exists
  await env.DB.prepare(`
    UPDATE restaurant_leads
    SET status = 'not_interested',
        notes = COALESCE(notes, '') || '\n[' || datetime(?, 'unixepoch') || '] ' || ? || ' via email.',
        updated_at = ?
    WHERE contact_email = ?
  `).bind(
    now,
    isUnsubscribe ? 'Unsubscribed' : 'Declined',
    now,
    fromEmail
  ).run();

  // Add to suppression list if unsubscribe
  if (isUnsubscribe) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO email_suppression_list (id, email, reason, source, suppressed_at, created_at)
      VALUES (?, ?, 'unsubscribe_reply', 'inbound_webhook', ?, ?)
    `).bind(generateId('sup'), fromEmail, now, now).run();
  }
}

async function handleMenuAttachment(
  env: Env,
  emailId: string,
  fromEmail: string,
  attachments: Array<{ key: string; filename: string; contentType: string }>,
  now: number
): Promise<void> {
  console.log(`[Inbound] Processing menu attachment from: ${fromEmail}`);

  // Create menu processing queue entry
  for (const attachment of attachments) {
    if (isMenuAttachment({ filename: attachment.filename, content: '', content_type: attachment.contentType })) {
      await env.DB.prepare(`
        INSERT INTO menu_processing_queue (
          id, inbound_email_id, from_email, r2_key, filename, content_type,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `).bind(
        generateId('menu'),
        emailId,
        fromEmail,
        attachment.key,
        attachment.filename,
        attachment.contentType,
        now
      ).run();
    }
  }

  // Create task for menu processing
  await createTask(env, {
    type: 'menu_processing',
    title: `Menu received from ${fromEmail}`,
    description: `${attachments.length} attachment(s) received. Review and process menu data.`,
    priority: 'medium',
    relatedId: emailId,
    relatedType: 'inbound_email',
  }, now);
}

async function createTask(
  env: Env,
  task: {
    type: string;
    title: string;
    description: string;
    priority: string;
    relatedId?: string;
    relatedType?: string;
    dueAt?: number;
  },
  now: number
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO tasks (
      id, type, title, description, priority, status,
      related_id, related_type, due_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
  `).bind(
    generateId('task'),
    task.type,
    task.title,
    task.description,
    task.priority,
    task.relatedId || null,
    task.relatedType || null,
    task.dueAt || null,
    now,
    now
  ).run();
}

// ============================================
// MAIN INBOUND EMAIL HANDLER
// ============================================

async function handleInboundEmail(
  env: Env,
  email: ResendInboundEmail
): Promise<{ success: boolean; emailId: string; classification: EmailClassification }> {
  const now = Math.floor(Date.now() / 1000);
  const emailId = generateId('inb');

  // Parse from address
  const parsed = parseEmailAddress(email.from);
  const fromEmail = parsed.email;
  const fromName = parsed.name;

  // Parse to address(es)
  const toAddresses = Array.isArray(email.to) ? email.to : [email.to];
  const toEmail = toAddresses[0];

  console.log(`[Inbound] Processing email from ${fromEmail} to ${toEmail}: "${email.subject}"`);

  // Extract reply headers
  const { inReplyTo, references } = extractReplyHeaders(email.headers);

  // Find original email if this is a reply
  let originalEmailId: string | null = null;
  if (inReplyTo) {
    const original = await env.DB.prepare(`
      SELECT id FROM email_logs WHERE resend_id = ? OR message_id = ? LIMIT 1
    `).bind(inReplyTo, inReplyTo).first<{ id: string }>();
    originalEmailId = original?.id || null;
  }

  // Process attachments
  const attachments: Array<{ key: string; filename: string; contentType: string; size: number }> = [];
  if (email.attachments && email.attachments.length > 0) {
    for (let i = 0; i < email.attachments.length; i++) {
      const att = email.attachments[i];
      const stored = await storeAttachment(env, emailId, att, i);
      attachments.push({
        key: stored.key,
        filename: att.filename,
        contentType: att.content_type,
        size: att.size || 0,
      });
    }
  }

  // Classify email with AI
  const classification = await classifyEmail(
    env,
    email.subject,
    email.text || null,
    attachments.length > 0,
    attachments.map(a => a.filename)
  );

  console.log(`[Inbound] Classification: ${classification.intent} (confidence: ${classification.confidence})`);

  // Store email in database
  await env.DB.prepare(`
    INSERT INTO inbound_emails (
      id, from_email, from_name, to_email, cc_email, subject,
      body_text, body_html, headers_json, classification, confidence,
      sentiment, summary, is_reply, original_email_id, has_attachments,
      attachment_count, attachments_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processed', ?)
  `).bind(
    emailId,
    fromEmail,
    fromName,
    toEmail,
    email.cc ? (Array.isArray(email.cc) ? email.cc.join(', ') : email.cc) : null,
    email.subject,
    email.text || null,
    email.html || null,
    email.headers ? JSON.stringify(email.headers) : null,
    classification.intent,
    classification.confidence,
    classification.sentiment,
    classification.summary,
    classification.isReply ? 1 : 0,
    originalEmailId,
    attachments.length > 0 ? 1 : 0,
    attachments.length,
    attachments.length > 0 ? JSON.stringify(attachments) : null,
    now
  ).run();

  // Route to appropriate handler based on classification
  switch (classification.intent) {
    case 'positive_response':
      await handlePositiveResponse(env, emailId, fromEmail, classification, now);
      break;

    case 'negative_response':
      await handleNegativeResponse(env, emailId, fromEmail, false, now);
      break;

    case 'unsubscribe':
      await handleNegativeResponse(env, emailId, fromEmail, true, now);
      break;

    case 'menu_attachment':
      if (attachments.length > 0) {
        await handleMenuAttachment(env, emailId, fromEmail, attachments, now);
      }
      break;

    case 'general_inquiry':
      // Create task for general inquiry
      await createTask(env, {
        type: 'inquiry',
        title: `New inquiry from ${fromEmail}`,
        description: `Subject: ${email.subject}\n\nSummary: ${classification.summary}`,
        priority: classification.suggestedPriority,
        relatedId: emailId,
        relatedType: 'inbound_email',
      }, now);
      break;

    case 'out_of_office':
    case 'spam':
      // Log but don't create tasks
      console.log(`[Inbound] Skipping ${classification.intent} email from ${fromEmail}`);
      break;
  }

  return { success: true, emailId, classification };
}

// ============================================
// API KEY VERIFICATION
// ============================================

function verifyApiKey(request: Request, env: Env): boolean {
  if (!env.WORKER_API_KEY) return false;

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === env.WORKER_API_KEY;
  }

  const apiKeyHeader = request.headers.get('X-API-Key');
  return apiKeyHeader === env.WORKER_API_KEY;
}

// ============================================
// WORKER EXPORTS
// ============================================

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'rg-email-inbound',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Main inbound webhook endpoint
    if (url.pathname === '/inbound' && request.method === 'POST') {
      try {
        // Verify webhook signature
        const verification = await verifyResendWebhook(request, env.RESEND_INBOUND_WEBHOOK_SECRET);

        if (!verification.valid) {
          console.error(`[Inbound] Invalid webhook: ${verification.error}`);
          return new Response(JSON.stringify({ success: false, error: verification.error }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Parse email payload
        const payload = JSON.parse(verification.body);
        const emailData: ResendInboundEmail = payload.data || payload;

        // Validate required fields
        if (!emailData.from || !emailData.to || !emailData.subject) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields: from, to, or subject',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Check if email is to an allowed address
        const allowedAddresses = env.ALLOWED_TO_ADDRESSES.split(',').map(e => e.trim().toLowerCase());
        const toAddresses = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
        const isAllowed = toAddresses.some(to => {
          const { email } = parseEmailAddress(to);
          return allowedAddresses.includes(email);
        });

        if (!isAllowed) {
          console.log(`[Inbound] Email to non-allowed address: ${emailData.to}`);
          return new Response(JSON.stringify({
            success: true,
            skipped: 'recipient_not_configured',
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Process the email
        const result = await handleInboundEmail(env, emailData);

        return new Response(JSON.stringify({
          success: true,
          emailId: result.emailId,
          classification: result.classification.intent,
          confidence: result.classification.confidence,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('[Inbound] Error processing email:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Return 200 to prevent Resend from retrying
        return new Response(JSON.stringify({
          success: false,
          error: errorMessage,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Stats endpoint (admin only)
    if (url.pathname === '/stats' && request.method === 'GET') {
      if (!verifyApiKey(request, env)) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const now = Math.floor(Date.now() / 1000);
        const oneDayAgo = now - 86400;
        const oneWeekAgo = now - 604800;

        const stats = await env.DB.prepare(`
          SELECT
            (SELECT COUNT(*) FROM inbound_emails) as total_emails,
            (SELECT COUNT(*) FROM inbound_emails WHERE created_at > ?) as emails_24h,
            (SELECT COUNT(*) FROM inbound_emails WHERE created_at > ?) as emails_7d,
            (SELECT COUNT(*) FROM inbound_emails WHERE classification = 'positive_response') as positive_responses,
            (SELECT COUNT(*) FROM inbound_emails WHERE classification = 'negative_response') as negative_responses,
            (SELECT COUNT(*) FROM inbound_emails WHERE classification = 'unsubscribe') as unsubscribes,
            (SELECT COUNT(*) FROM inbound_emails WHERE classification = 'menu_attachment') as menu_attachments,
            (SELECT COUNT(*) FROM inbound_emails WHERE classification = 'general_inquiry') as general_inquiries,
            (SELECT COUNT(*) FROM tasks WHERE status = 'open') as open_tasks
        `).bind(oneDayAgo, oneWeekAgo).first();

        return new Response(JSON.stringify({ success: true, stats }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: String(error) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Recent emails endpoint (admin only)
    if (url.pathname === '/recent' && request.method === 'GET') {
      if (!verifyApiKey(request, env)) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const { results } = await env.DB.prepare(`
          SELECT id, from_email, from_name, subject, classification, confidence,
                 sentiment, summary, has_attachments, created_at,
                 datetime(created_at, 'unixepoch') as created_at_readable
          FROM inbound_emails
          ORDER BY created_at DESC
          LIMIT ?
        `).bind(Math.min(limit, 100)).all();

        return new Response(JSON.stringify({ success: true, emails: results }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: String(error) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Default response
    return new Response('R&G Consulting Email Inbound Worker', { status: 200 });
  },
};
