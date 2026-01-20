/**
 * Data Validation API for Cape Cod Restaurant Directory
 *
 * POST /api/directory/validate - Validate data before import
 * GET /api/directory/validation-rules - Get all validation rules
 *
 * Validates against import_validation_rules table
 * Prevents garbage data at import time
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

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

// Village to town mapping (for auto-correction)
const VILLAGE_TOWN_MAP = {
  'Hyannis': 'Barnstable',
  'Centerville': 'Barnstable',
  'Osterville': 'Barnstable',
  'Cotuit': 'Barnstable',
  'Marstons Mills': 'Barnstable',
  'West Barnstable': 'Barnstable',
  'Barnstable Village': 'Barnstable',
  'Woods Hole': 'Falmouth',
  'Falmouth Heights': 'Falmouth',
  'East Falmouth': 'Falmouth',
  'West Falmouth': 'Falmouth',
  'North Falmouth': 'Falmouth',
  'Harwich Port': 'Harwich',
  'West Harwich': 'Harwich',
  'East Harwich': 'Harwich',
  'South Yarmouth': 'Yarmouth',
  'West Yarmouth': 'Yarmouth',
  'Yarmouth Port': 'Yarmouth',
  'South Dennis': 'Dennis',
  'East Dennis': 'Dennis',
  'West Dennis': 'Dennis',
  'Dennis Port': 'Dennis',
  'North Chatham': 'Chatham',
  'South Chatham': 'Chatham',
  'West Chatham': 'Chatham',
  'North Truro': 'Truro',
  'South Wellfleet': 'Wellfleet',
  'North Eastham': 'Eastham',
  'Buzzards Bay': 'Bourne',
  'Sagamore': 'Bourne',
  'Sagamore Beach': 'Bourne',
  'Monument Beach': 'Bourne',
  'Pocasset': 'Bourne',
  'Cataumet': 'Bourne',
  'East Sandwich': 'Sandwich',
  'Forestdale': 'Sandwich',
  'Mashpee Commons': 'Mashpee',
  'New Seabury': 'Mashpee',
  'Popponesset': 'Mashpee',
};

// Apply validation rule to a value
function applyRule(rule, value, record) {
  const config = JSON.parse(rule.rule_config);

  switch (rule.rule_type) {
    case 'required':
      if (value === null || value === undefined || value === '') {
        return { valid: false, message: rule.error_message };
      }
      break;

    case 'enum':
      if (value && config.values && !config.values.includes(value)) {
        return {
          valid: false,
          message: rule.error_message,
          suggestion: findClosestMatch(value, config.values),
        };
      }
      break;

    case 'range':
      if (value !== null && value !== undefined) {
        const num = parseFloat(value);
        if (isNaN(num) || num < config.min || num > config.max) {
          return { valid: false, message: rule.error_message };
        }
      }
      break;

    case 'custom':
      if (config.type === 'blocklist' && value && config.values) {
        if (config.values.includes(value)) {
          return { valid: false, message: rule.error_message };
        }
      }
      if (config.type === 'regex' && value && config.pattern) {
        const regex = new RegExp(config.pattern);
        if (!regex.test(value)) {
          return { valid: false, message: rule.error_message };
        }
      }
      break;
  }

  return { valid: true };
}

// Find closest match for suggestions
function findClosestMatch(input, options) {
  if (!input || !options || options.length === 0) return null;

  const inputLower = input.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const option of options) {
    const optionLower = option.toLowerCase();

    // Check if input starts with or contains option
    if (optionLower.includes(inputLower) || inputLower.includes(optionLower)) {
      const score = optionLower === inputLower ? 1 : 0.8;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = option;
      }
    }

    // Simple character match score
    let matchScore = 0;
    for (let i = 0; i < Math.min(inputLower.length, optionLower.length); i++) {
      if (inputLower[i] === optionLower[i]) matchScore++;
    }
    const normalizedScore = matchScore / Math.max(inputLower.length, optionLower.length);
    if (normalizedScore > bestScore && normalizedScore > 0.5) {
      bestScore = normalizedScore;
      bestMatch = option;
    }
  }

  return bestMatch;
}

// Auto-correct and enhance record
function autoCorrectRecord(record) {
  const corrected = { ...record };
  const corrections = [];

  // Auto-correct village to town
  if (corrected.town && VILLAGE_TOWN_MAP[corrected.town]) {
    const village = corrected.town;
    corrected.village = village;
    corrected.town = VILLAGE_TOWN_MAP[village];
    corrections.push(`Corrected "${village}" to town "${corrected.town}" (village preserved)`);
  }

  // Auto-assign region from town
  if (corrected.town && TOWN_REGION_MAP[corrected.town] && !corrected.region) {
    corrected.region = TOWN_REGION_MAP[corrected.town];
    corrections.push(`Auto-assigned region "${corrected.region}" from town`);
  }

  // Normalize POS system names
  if (corrected.pos_system) {
    const posNormalized = normalizePosSystem(corrected.pos_system);
    if (posNormalized !== corrected.pos_system) {
      corrections.push(`Normalized POS system "${corrected.pos_system}" to "${posNormalized}"`);
      corrected.pos_system = posNormalized;
    }
  }

  // Ensure price_level is integer
  if (corrected.price_level && typeof corrected.price_level === 'string') {
    if (corrected.price_level.match(/^\$+$/)) {
      corrected.price_level = corrected.price_level.length;
      corrections.push(`Converted price "${record.price_level}" to level ${corrected.price_level}`);
    }
  }

  return { corrected, corrections };
}

// Normalize POS system names
function normalizePosSystem(pos) {
  const normalized = {
    'toast pos': 'Toast',
    'toast': 'Toast',
    'square pos': 'Square',
    'square': 'Square',
    'square point of sale': 'Square',
    'clover pos': 'Clover',
    'clover': 'Clover',
    'aloha': 'Aloha',
    'aloha pos': 'Aloha',
    'ncr aloha': 'Aloha',
    'micros': 'Micros',
    'oracle micros': 'Micros',
    'lightspeed': 'Lightspeed',
    'lightspeed restaurant': 'Lightspeed',
    'upserve': 'Upserve',
    'breadcrumb': 'Upserve',
    'touchbistro': 'TouchBistro',
    'touch bistro': 'TouchBistro',
    'revel': 'Revel',
    'revel systems': 'Revel',
    'spoton': 'SpotOn',
    'spot on': 'SpotOn',
    'ncr': 'NCR',
    'ncr silver': 'NCR',
    'heartland': 'Heartland',
    'lavu': 'Lavu',
    'unknown': 'Unknown',
    '': 'Unknown',
  };

  const key = (pos || '').toLowerCase().trim();
  return normalized[key] || pos;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET - Retrieve validation rules
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const rules = await env.DB.prepare(`
      SELECT * FROM import_validation_rules WHERE active = 1 ORDER BY field_name, severity
    `).all();

    return new Response(
      JSON.stringify({
        success: true,
        rules: rules.results || [],
        town_region_map: TOWN_REGION_MAP,
        village_town_map: VILLAGE_TOWN_MAP,
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST - Validate records before import
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { records } = body;

    if (!records || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({ success: false, error: 'records array is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Load validation rules
    const rulesResult = await env.DB.prepare(`
      SELECT * FROM import_validation_rules WHERE active = 1
    `).all();
    const rules = rulesResult.results || [];

    // Group rules by field
    const rulesByField = {};
    for (const rule of rules) {
      if (!rulesByField[rule.field_name]) {
        rulesByField[rule.field_name] = [];
      }
      rulesByField[rule.field_name].push(rule);
    }

    // Validate each record
    const results = [];
    let validCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (let i = 0; i < records.length; i++) {
      const original = records[i];
      const { corrected, corrections } = autoCorrectRecord(original);

      const errors = [];
      const warnings = [];
      const infos = [];

      // Apply all rules
      for (const [fieldName, fieldRules] of Object.entries(rulesByField)) {
        const value = corrected[fieldName];

        for (const rule of fieldRules) {
          const result = applyRule(rule, value, corrected);

          if (!result.valid) {
            const issue = {
              field: fieldName,
              message: result.message,
              value: value,
              suggestion: result.suggestion,
            };

            switch (rule.severity) {
              case 'error':
                errors.push(issue);
                break;
              case 'warning':
                warnings.push(issue);
                break;
              case 'info':
                infos.push(issue);
                break;
            }
          }
        }
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else errorCount++;
      if (warnings.length > 0) warningCount++;

      results.push({
        index: i,
        original,
        corrected,
        corrections,
        valid: isValid,
        errors,
        warnings,
        infos,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: records.length,
          valid: validCount,
          errors: errorCount,
          warnings: warningCount,
        },
        results,
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
