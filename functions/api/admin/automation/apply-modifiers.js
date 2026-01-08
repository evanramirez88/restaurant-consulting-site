/**
 * Apply Modifier Rules to Menu Items API
 *
 * POST /api/admin/automation/apply-modifiers
 * Takes menu items and applies matching modifier rules based on classification/template
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { menu_items, template_id, classification_id } = body;

    if (!menu_items || !Array.isArray(menu_items)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'menu_items array is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get modifier rules for the template
    let rules = [];
    if (template_id) {
      const rulesResult = await env.DB.prepare(`
        SELECT * FROM modifier_rules
        WHERE (template_id = ? OR template_id IS NULL)
          AND is_active = 1
        ORDER BY priority DESC
      `).bind(template_id).all();
      rules = rulesResult.results || [];
    } else if (classification_id) {
      // Get template from classification
      const classification = await env.DB.prepare(`
        SELECT config_template_id FROM restaurant_classifications WHERE id = ?
      `).bind(classification_id).first();

      if (classification?.config_template_id) {
        const rulesResult = await env.DB.prepare(`
          SELECT * FROM modifier_rules
          WHERE (template_id = ? OR template_id IS NULL)
            AND is_active = 1
          ORDER BY priority DESC
        `).bind(classification.config_template_id).all();
        rules = rulesResult.results || [];
      }
    } else {
      // Get all active rules
      const rulesResult = await env.DB.prepare(`
        SELECT * FROM modifier_rules
        WHERE is_active = 1
        ORDER BY priority DESC
      `).all();
      rules = rulesResult.results || [];
    }

    // Apply rules to each menu item
    const processedItems = menu_items.map(item => {
      const appliedModifiers = [];
      const matchedRules = [];

      for (const rule of rules) {
        if (doesItemMatchRule(item, rule)) {
          matchedRules.push({
            rule_id: rule.id,
            rule_name: rule.rule_name
          });

          // Add modifier group to item
          const modifierGroup = {
            name: rule.modifier_group_name,
            type: rule.modifier_group_type || 'single',
            min_selections: rule.modifier_min_selections || 1,
            max_selections: rule.modifier_max_selections || 1,
            is_required: rule.is_required === 1,
            options: JSON.parse(rule.modifier_options_json || '[]'),
            applied_by_rule: rule.id
          };

          appliedModifiers.push(modifierGroup);
        }
      }

      return {
        ...item,
        applied_modifier_groups: appliedModifiers,
        matched_rules: matchedRules,
        has_auto_modifiers: appliedModifiers.length > 0
      };
    });

    // Summary statistics
    const stats = {
      total_items: menu_items.length,
      items_with_modifiers: processedItems.filter(i => i.has_auto_modifiers).length,
      total_modifiers_applied: processedItems.reduce((sum, i) => sum + i.applied_modifier_groups.length, 0),
      rules_evaluated: rules.length
    };

    return new Response(JSON.stringify({
      success: true,
      data: {
        items: processedItems,
        stats
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Check if a menu item matches a modifier rule
 */
function doesItemMatchRule(item, rule) {
  const triggerType = rule.trigger_type;
  const pattern = rule.trigger_pattern;
  const caseSensitive = rule.trigger_case_sensitive === 1;

  let textToMatch = '';

  switch (triggerType) {
    case 'item_name':
      textToMatch = item.name || '';
      break;
    case 'category':
      textToMatch = item.category || '';
      break;
    case 'tag':
      textToMatch = (item.tags || []).join(' ');
      break;
    case 'ingredient':
      textToMatch = (item.ingredients || []).join(' ') + ' ' + (item.description || '');
      break;
    default:
      textToMatch = item.name || '';
  }

  if (!caseSensitive) {
    textToMatch = textToMatch.toLowerCase();
  }

  try {
    // Try as regex first
    const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
    return regex.test(textToMatch);
  } catch {
    // Fall back to simple includes check
    const searchPattern = caseSensitive ? pattern : pattern.toLowerCase();
    return textToMatch.includes(searchPattern);
  }
}
