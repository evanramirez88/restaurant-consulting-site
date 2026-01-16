/**
 * Data Import API for Intelligence Dashboard
 *
 * POST /api/admin/intelligence/import - Import data from file or text
 *
 * Supports:
 * - CSV files (bulk lead import)
 * - JSON files (structured data)
 * - Text/Markdown (AI extraction)
 * - Pasted text content (AI extraction)
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const contentType = request.headers.get('content-type') || '';

    let text = '';
    let fileName = 'manual_input';
    let fileType = 'txt';
    let clientId = null;

    // Handle multipart form data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      text = formData.get('text');
      clientId = formData.get('client_id');

      if (file && file instanceof File) {
        fileName = file.name;
        fileType = getFileType(fileName);
        text = await file.text();
      }
    } else {
      // Handle JSON body
      const body = await request.json();
      text = body.text;
      clientId = body.client_id;
      fileName = body.file_name || 'manual_input';
      fileType = body.file_type || 'txt';
    }

    if (!text || text.length < 10) {
      return Response.json({
        success: false,
        error: 'No content provided or content too short',
      }, { status: 400 });
    }

    // Create import record
    const importId = 'import_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

    await env.DB.prepare(`
      INSERT INTO file_imports (
        id, file_name, file_type, file_size, import_status, created_at
      ) VALUES (?, ?, ?, ?, 'processing', unixepoch())
    `).bind(importId, fileName, fileType, text.length).run();

    let result;

    // Process based on file type
    if (fileType === 'csv') {
      result = await processCSV(env, importId, text, clientId);
    } else if (fileType === 'json') {
      result = await processJSON(env, importId, text, clientId);
    } else {
      // Text/Markdown - use AI extraction
      result = await processText(env, importId, text, clientId);
    }

    // Update import record with results
    await env.DB.prepare(`
      UPDATE file_imports
      SET import_status = ?,
          records_found = ?,
          records_imported = ?,
          facts_extracted = ?,
          processing_completed_at = unixepoch(),
          error_message = ?
      WHERE id = ?
    `).bind(
      result.success ? 'completed' : 'failed',
      result.records_found || 0,
      result.records_imported || 0,
      result.facts_extracted || 0,
      result.error || null,
      importId
    ).run();

    return Response.json({
      success: result.success,
      import_id: importId,
      records_found: result.records_found || 0,
      records_imported: result.records_imported || 0,
      facts_extracted: result.facts_extracted || 0,
      message: result.message,
      error: result.error,
    });
  } catch (error) {
    console.error('Import API error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

function getFileType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const typeMap = {
    'csv': 'csv',
    'json': 'json',
    'txt': 'txt',
    'md': 'md',
    'pdf': 'pdf',
    'xlsx': 'xlsx',
    'xls': 'xlsx',
    'docx': 'docx',
  };
  return typeMap[ext] || 'txt';
}

async function processCSV(env, importId, text, clientId) {
  try {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return { success: false, error: 'CSV must have headers and at least one data row' };
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const records = [];
    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const record = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx] || '';
      });
      records.push(record);

      // Try to import as lead
      const leadId = 'lead_import_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
      const companyName = record['company'] || record['company_name'] || record['business'] || record['name'] || '';
      const email = record['email'] || '';

      if (companyName || email) {
        try {
          await env.DB.prepare(`
            INSERT OR IGNORE INTO restaurant_leads (
              id, company_name, contact_name, email, phone, website,
              city, state, vertical, current_pos, lead_score, source, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', unixepoch())
          `).bind(
            leadId,
            companyName,
            record['contact'] || record['contact_name'] || '',
            email,
            record['phone'] || '',
            record['website'] || '',
            record['city'] || record['town'] || '',
            record['state'] || '',
            record['vertical'] || record['category'] || 'Food & Drink',
            record['pos'] || record['pos_system'] || record['current_pos'] || '',
            parseInt(record['lead_score']) || 50
          ).run();
          imported++;
        } catch (insertError) {
          // Skip duplicates
          console.log('Skipping duplicate:', companyName);
        }
      }
    }

    return {
      success: true,
      records_found: records.length,
      records_imported: imported,
      message: `Imported ${imported} of ${records.length} records`,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

async function processJSON(env, importId, text, clientId) {
  try {
    const data = JSON.parse(text);
    const records = Array.isArray(data) ? data : [data];
    let imported = 0;
    let factsExtracted = 0;

    for (const record of records) {
      // If it looks like a lead, import to restaurant_leads
      if (record.company || record.company_name || record.email) {
        const leadId = 'lead_import_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);

        try {
          await env.DB.prepare(`
            INSERT OR IGNORE INTO restaurant_leads (
              id, company_name, contact_name, email, phone, website,
              city, state, vertical, current_pos, lead_score, source, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', unixepoch())
          `).bind(
            leadId,
            record.company || record.company_name || '',
            record.contact || record.contact_name || '',
            record.email || '',
            record.phone || '',
            record.website || '',
            record.city || record.town || '',
            record.state || '',
            record.vertical || record.category || 'Food & Drink',
            record.pos || record.pos_system || '',
            record.lead_score || 50
          ).run();
          imported++;
        } catch (insertError) {
          console.log('Skipping duplicate record');
        }
      }

      // If client_id provided, extract facts from the record
      if (clientId) {
        const factFields = ['cuisine_type', 'service_style', 'seating_capacity', 'pos_system', 'website', 'phone', 'employee_count'];

        for (const field of factFields) {
          if (record[field]) {
            const factId = 'fact_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
            await env.DB.prepare(`
              INSERT INTO client_atomic_facts (
                id, client_id, field_name, field_value, source, confidence, status, created_at
              ) VALUES (?, ?, ?, ?, 'import', 0.8, 'pending', unixepoch())
            `).bind(factId, clientId, field, String(record[field])).run();
            factsExtracted++;
          }
        }
      }
    }

    return {
      success: true,
      records_found: records.length,
      records_imported: imported,
      facts_extracted: factsExtracted,
      message: `Processed ${records.length} records, imported ${imported}, extracted ${factsExtracted} facts`,
    };
  } catch (error) {
    return { success: false, error: `JSON parse error: ${error.message}` };
  }
}

async function processText(env, importId, text, clientId) {
  try {
    // Use pattern-based extraction (same as extract.js)
    const facts = extractFactsFromText(text);

    let factsExtracted = 0;

    if (clientId && facts.length > 0) {
      for (const fact of facts) {
        const factId = 'fact_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
        await env.DB.prepare(`
          INSERT INTO client_atomic_facts (
            id, client_id, field_name, field_value, original_text, source, confidence, status, created_at
          ) VALUES (?, ?, ?, ?, ?, 'import', ?, 'pending', unixepoch())
        `).bind(
          factId, clientId, fact.field, fact.value, fact.originalText || '', fact.confidence
        ).run();
        factsExtracted++;
      }
    }

    // Also try to identify any leads in the text
    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    let leadsFound = 0;

    for (const email of emails) {
      // Check if this email is already in the system
      const exists = await env.DB.prepare(
        'SELECT id FROM restaurant_leads WHERE email = ?'
      ).bind(email).first();

      if (!exists) {
        const leadId = 'lead_text_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
        await env.DB.prepare(`
          INSERT INTO restaurant_leads (
            id, email, source, lead_score, created_at
          ) VALUES (?, ?, 'text_import', 30, unixepoch())
        `).bind(leadId, email).run();
        leadsFound++;
      }
    }

    return {
      success: true,
      records_found: emails.length,
      records_imported: leadsFound,
      facts_extracted: factsExtracted,
      message: `Extracted ${factsExtracted} facts${clientId ? ' for client' : ''}, found ${leadsFound} new leads`,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function extractFactsFromText(text) {
  const facts = [];
  const lowerText = text.toLowerCase();

  // Cuisine type detection
  const cuisines = ['italian', 'mexican', 'chinese', 'japanese', 'american', 'french', 'thai', 'indian', 'seafood', 'steakhouse', 'pizza', 'sushi', 'mediterranean'];
  for (const cuisine of cuisines) {
    if (lowerText.includes(cuisine)) {
      const idx = lowerText.indexOf(cuisine);
      facts.push({
        field: 'cuisine_type',
        value: cuisine.charAt(0).toUpperCase() + cuisine.slice(1),
        confidence: 0.75,
        originalText: text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + cuisine.length + 20)).trim(),
      });
      break;
    }
  }

  // POS system detection
  const posSystems = ['toast', 'square', 'clover', 'lightspeed', 'aloha', 'micros', 'upserve', 'revel', 'shopify'];
  for (const pos of posSystems) {
    if (lowerText.includes(pos)) {
      const idx = lowerText.indexOf(pos);
      facts.push({
        field: 'pos_system',
        value: pos.charAt(0).toUpperCase() + pos.slice(1),
        confidence: 0.85,
        originalText: text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + pos.length + 20)).trim(),
      });
      break;
    }
  }

  // Service style detection
  const serviceStyles = {
    'fine dining': 'Fine Dining',
    'casual dining': 'Casual Dining',
    'fast casual': 'Fast Casual',
    'quick service': 'Quick Service',
    'full service': 'Full Service',
    'counter service': 'Counter Service',
    'food truck': 'Food Truck',
    'ghost kitchen': 'Ghost Kitchen',
  };
  for (const [pattern, value] of Object.entries(serviceStyles)) {
    if (lowerText.includes(pattern)) {
      facts.push({
        field: 'service_style',
        value: value,
        confidence: 0.8,
        originalText: pattern,
      });
      break;
    }
  }

  // Phone number detection
  const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    facts.push({
      field: 'phone',
      value: phoneMatch[0],
      confidence: 0.9,
      originalText: phoneMatch[0],
    });
  }

  // Email detection
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    facts.push({
      field: 'email',
      value: emailMatch[0],
      confidence: 0.95,
      originalText: emailMatch[0],
    });
  }

  // Website detection
  const websiteMatch = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
  if (websiteMatch) {
    facts.push({
      field: 'website',
      value: websiteMatch[0],
      confidence: 0.9,
      originalText: websiteMatch[0],
    });
  }

  // Seating capacity detection
  const seatingMatch = text.match(/(\d+)\s*(seats?|covers|capacity|seating)/i);
  if (seatingMatch) {
    facts.push({
      field: 'seating_capacity',
      value: seatingMatch[1],
      confidence: 0.7,
      originalText: seatingMatch[0],
    });
  }

  // Employee count detection
  const employeeMatch = text.match(/(\d+)\s*(employees?|staff|team members?|workers?)/i);
  if (employeeMatch) {
    facts.push({
      field: 'employee_count',
      value: employeeMatch[1],
      confidence: 0.7,
      originalText: employeeMatch[0],
    });
  }

  // Revenue/sales detection
  const revenueMatch = text.match(/\$\s*([\d,]+)\s*(million|m|k|thousand)?(?:\s*(?:revenue|sales|annual|yearly))?/i);
  if (revenueMatch) {
    facts.push({
      field: 'estimated_revenue',
      value: revenueMatch[0],
      confidence: 0.6,
      originalText: revenueMatch[0],
    });
  }

  return facts;
}
