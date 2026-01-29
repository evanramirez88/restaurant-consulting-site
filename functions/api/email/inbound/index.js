/**
 * Inbound Email Handler - Pages Function
 *
 * Receives inbound emails via Resend webhook and processes them with AI classification.
 * This is an alternative route to the standalone worker - both can receive webhooks.
 *
 * Endpoint: POST /api/email/inbound
 *
 * Classifications:
 * - positive_response: Lead interested, wants to schedule call
 * - negative_response: Declined, not interested
 * - unsubscribe: Wants to stop receiving emails
 * - menu_attachment: Contains menu documents
 * - general_inquiry: General questions
 * - out_of_office: Auto-reply
 * - spam: Irrelevant/promotional
 */

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

function parseEmailAddress(email) {
  const match = email.match(/^(?:(.+?)\s*<)?([^<>]+@[^<>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2].trim().toLowerCase(),
    };
  }
  return { name: null, email: email.toLowerCase() };
}

// ============================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================

async function verifyWebhookSignature(request, secret) {
  if (!secret) {
    console.warn('[Inbound] No webhook secret configured');
    return { valid: true, body: await request.text() };
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valid: false, body: null, error: 'Missing svix headers' };
  }

  const timestampSeconds = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSeconds) > 300) {
    return { valid: false, body: null, error: 'Timestamp out of tolerance' };
  }

  const body = await request.text();

  try {
    const signedContent = `${svixId}.${svixTimestamp}.${body}`;
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
        return { valid: true, body };
      }
    }

    return { valid: false, body, error: 'Signature mismatch' };
  } catch (error) {
    return { valid: false, body: null, error: error.message };
  }
}

// ============================================
// AI CLASSIFICATION
// ============================================

async function classifyEmailWithAI(ai, subject, bodyText, hasAttachments, attachmentFilenames) {
  const systemPrompt = `You are an email classifier for R&G Consulting, a restaurant technology consulting company.

Classify emails into one category:
- positive_response: Interested in services, wants call/meeting
- negative_response: Not interested, declines
- unsubscribe: Wants to stop emails
- menu_attachment: Contains restaurant menu
- general_inquiry: General questions
- out_of_office: Auto-reply/vacation
- spam: Irrelevant email

Return JSON only:
{
  "intent": "category",
  "confidence": 0.0-1.0,
  "sentiment": "positive|neutral|negative",
  "summary": "1 sentence",
  "priority": "high|medium|low"
}`;

  const userPrompt = `Subject: ${subject}\n\nBody:\n${(bodyText || '').substring(0, 1500)}\n\nHas attachments: ${hasAttachments}\nFilenames: ${attachmentFilenames.join(', ') || 'none'}`;

  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 300,
    });

    const responseText = response?.response || '';
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        intent: parsed.intent || 'general_inquiry',
        confidence: parsed.confidence || 0.7,
        sentiment: parsed.sentiment || 'neutral',
        summary: parsed.summary || 'Email received',
        priority: parsed.priority || 'medium',
        hasMenuAttachment: hasAttachments,
        isReply: subject.toLowerCase().startsWith('re:'),
      };
    } catch {
      return getFallbackClassification(subject, bodyText, hasAttachments);
    }
  } catch (error) {
    console.error('[Inbound] AI error:', error);
    return getFallbackClassification(subject, bodyText, hasAttachments);
  }
}

function getFallbackClassification(subject, bodyText, hasAttachments) {
  const combined = ((subject || '') + ' ' + (bodyText || '')).toLowerCase();

  if (combined.includes('unsubscribe') || combined.includes('remove me')) {
    return { intent: 'unsubscribe', confidence: 0.8, sentiment: 'negative', summary: 'Unsubscribe request', priority: 'high', hasMenuAttachment: false, isReply: false };
  }
  if (combined.includes('not interested') || combined.includes('no thanks')) {
    return { intent: 'negative_response', confidence: 0.7, sentiment: 'negative', summary: 'Declined', priority: 'low', hasMenuAttachment: false, isReply: false };
  }
  if (combined.includes('out of office') || combined.includes('auto-reply')) {
    return { intent: 'out_of_office', confidence: 0.9, sentiment: 'neutral', summary: 'Auto-reply', priority: 'low', hasMenuAttachment: false, isReply: false };
  }
  if (combined.includes('interested') || combined.includes('schedule') || combined.includes('call me')) {
    return { intent: 'positive_response', confidence: 0.7, sentiment: 'positive', summary: 'Interested', priority: 'high', hasMenuAttachment: hasAttachments, isReply: subject.toLowerCase().startsWith('re:') };
  }
  if (hasAttachments && combined.includes('menu')) {
    return { intent: 'menu_attachment', confidence: 0.7, sentiment: 'neutral', summary: 'Menu received', priority: 'medium', hasMenuAttachment: true, isReply: false };
  }
  return { intent: 'general_inquiry', confidence: 0.5, sentiment: 'neutral', summary: 'General email', priority: 'medium', hasMenuAttachment: hasAttachments, isReply: subject.toLowerCase().startsWith('re:') };
}

// ============================================
// BUSINESS LOGIC HANDLERS
// ============================================

async function handlePositiveResponse(db, emailId, fromEmail, classification, now) {
  console.log(`[Inbound] Positive response from: ${fromEmail}`);

  // Update subscriber engagement
  await db.prepare(`
    UPDATE email_subscribers
    SET engagement_score = MIN(100, COALESCE(engagement_score, 0) + 25),
        last_replied_at = ?,
        reply_count = COALESCE(reply_count, 0) + 1,
        updated_at = ?
    WHERE email = ?
  `).bind(now, now, fromEmail).run();

  // Update lead status
  const lead = await db.prepare(`
    SELECT id, restaurant_name FROM restaurant_leads WHERE contact_email = ? LIMIT 1
  `).bind(fromEmail).first();

  if (lead) {
    await db.prepare(`
      UPDATE restaurant_leads
      SET status = 'interested',
          score = MIN(100, COALESCE(score, 0) + 20),
          last_contact_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(now, now, lead.id).run();

    await db.prepare(`UPDATE inbound_emails SET lead_id = ? WHERE id = ?`).bind(lead.id, emailId).run();

    // Create task
    await db.prepare(`
      INSERT INTO tasks (id, type, title, description, priority, status, related_id, related_type, due_at, created_at, updated_at)
      VALUES (?, 'follow_up', ?, ?, 'high', 'open', ?, 'lead', ?, ?, ?)
    `).bind(
      generateId('task'),
      `Follow up: ${lead.restaurant_name} replied`,
      `${fromEmail} expressed interest. Summary: ${classification.summary}`,
      lead.id,
      now + 86400,
      now,
      now
    ).run();
  }
}

async function handleNegativeResponse(db, fromEmail, isUnsubscribe, now) {
  console.log(`[Inbound] ${isUnsubscribe ? 'Unsubscribe' : 'Negative'} from: ${fromEmail}`);

  await db.prepare(`
    UPDATE email_subscribers
    SET status = ?,
        unsubscribe_reason = ?,
        updated_at = ?
    WHERE email = ?
  `).bind(
    isUnsubscribe ? 'unsubscribed' : 'declined',
    isUnsubscribe ? 'email_reply' : 'declined_reply',
    now,
    fromEmail
  ).run();

  await db.prepare(`
    UPDATE subscriber_sequences
    SET status = 'cancelled',
        cancelled_at = ?,
        cancel_reason = ?,
        updated_at = ?
    WHERE subscriber_id IN (SELECT id FROM email_subscribers WHERE email = ?)
      AND status IN ('active', 'queued', 'paused')
  `).bind(now, isUnsubscribe ? 'Unsubscribed' : 'Declined', now, fromEmail).run();

  if (isUnsubscribe) {
    await db.prepare(`
      INSERT OR IGNORE INTO email_suppression_list (id, email, reason, source, suppressed_at, created_at)
      VALUES (?, ?, 'unsubscribe_reply', 'inbound_webhook', ?, ?)
    `).bind(generateId('sup'), fromEmail, now, now).run();
  }
}

async function storeAttachment(r2, emailId, attachment, index) {
  const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `inbound-emails/${emailId}/${index}_${sanitizedFilename}`;
  const binaryData = Uint8Array.from(atob(attachment.content), c => c.charCodeAt(0));

  await r2.put(key, binaryData, {
    httpMetadata: { contentType: attachment.content_type },
    customMetadata: { emailId, originalFilename: attachment.filename },
  });

  return { key, filename: attachment.filename, contentType: attachment.content_type };
}

// ============================================
// MAIN HANDLER
// ============================================

export async function onRequestPost(context) {
  const { request, env } = context;
  const now = Math.floor(Date.now() / 1000);

  try {
    // Verify signature
    const verification = await verifyWebhookSignature(request.clone(), env.RESEND_INBOUND_WEBHOOK_SECRET);
    if (!verification.valid) {
      console.error(`[Inbound] Invalid webhook: ${verification.error}`);
      return new Response(JSON.stringify({ success: false, error: verification.error }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.parse(verification.body);
    const emailData = payload.data || payload;

    if (!emailData.from || !emailData.to || !emailData.subject) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const emailId = generateId('inb');
    const parsed = parseEmailAddress(emailData.from);
    const fromEmail = parsed.email;
    const fromName = parsed.name;
    const toAddresses = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
    const toEmail = toAddresses[0];

    console.log(`[Inbound] Processing: ${fromEmail} -> ${toEmail}: "${emailData.subject}"`);

    // Process attachments
    const attachments = [];
    if (emailData.attachments?.length > 0 && env.R2_BUCKET) {
      for (let i = 0; i < emailData.attachments.length; i++) {
        const stored = await storeAttachment(env.R2_BUCKET, emailId, emailData.attachments[i], i);
        attachments.push(stored);
      }
    }

    // Classify with AI
    const classification = await classifyEmailWithAI(
      env.AI,
      emailData.subject,
      emailData.text,
      attachments.length > 0,
      attachments.map(a => a.filename)
    );

    console.log(`[Inbound] Classified as: ${classification.intent} (${classification.confidence})`);

    // Store email
    await env.DB.prepare(`
      INSERT INTO inbound_emails (
        id, from_email, from_name, to_email, cc_email, subject,
        body_text, body_html, headers_json, classification, confidence,
        sentiment, summary, is_reply, has_attachments, attachment_count,
        attachments_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processed', ?)
    `).bind(
      emailId,
      fromEmail,
      fromName,
      toEmail,
      emailData.cc ? (Array.isArray(emailData.cc) ? emailData.cc.join(', ') : emailData.cc) : null,
      emailData.subject,
      emailData.text || null,
      emailData.html || null,
      emailData.headers ? JSON.stringify(emailData.headers) : null,
      classification.intent,
      classification.confidence,
      classification.sentiment,
      classification.summary,
      classification.isReply ? 1 : 0,
      attachments.length > 0 ? 1 : 0,
      attachments.length,
      attachments.length > 0 ? JSON.stringify(attachments) : null,
      now
    ).run();

    // Route based on classification
    switch (classification.intent) {
      case 'positive_response':
        await handlePositiveResponse(env.DB, emailId, fromEmail, classification, now);
        break;
      case 'negative_response':
        await handleNegativeResponse(env.DB, fromEmail, false, now);
        break;
      case 'unsubscribe':
        await handleNegativeResponse(env.DB, fromEmail, true, now);
        break;
      case 'menu_attachment':
        if (attachments.length > 0) {
          for (const att of attachments) {
            await env.DB.prepare(`
              INSERT INTO menu_processing_queue (id, inbound_email_id, from_email, r2_key, filename, content_type, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
            `).bind(generateId('menu'), emailId, fromEmail, att.key, att.filename, att.contentType, now).run();
          }
        }
        break;
      case 'general_inquiry':
        await env.DB.prepare(`
          INSERT INTO tasks (id, type, title, description, priority, status, related_id, related_type, created_at, updated_at)
          VALUES (?, 'inquiry', ?, ?, ?, 'open', ?, 'inbound_email', ?, ?)
        `).bind(
          generateId('task'),
          `Inquiry from ${fromEmail}`,
          `Subject: ${emailData.subject}\n\n${classification.summary}`,
          classification.priority,
          emailId,
          now,
          now
        ).run();
        break;
    }

    return new Response(JSON.stringify({
      success: true,
      emailId,
      classification: classification.intent,
      confidence: classification.confidence,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Inbound] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, // Return 200 to prevent retries
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    endpoint: 'email-inbound',
    status: 'ok',
    description: 'POST inbound emails to this endpoint',
    timestamp: new Date().toISOString(),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
