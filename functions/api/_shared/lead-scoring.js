
/**
 * Lead Scoring Algorithm
 * Standardized scoring logic used by agents and API
 */

export const SCORING_WEIGHTS = {
    property_ownership: 3,
    tech_vulnerability: 2,
    social_presence: 1,
    menu_complexity: 2,
    price_point: 1,
    years_in_business: 1
};

export function calculateLeadScore(lead) {
    let score = 0;
    const factors = [];

    // 1. Property Ownership (30pts)
    // Owner/Operator or distinct property ownership implies stability and decision power
    if (lead.is_owner || lead.years_in_business > 5) {
        const points = 10 * SCORING_WEIGHTS.property_ownership;
        score += points;
        factors.push({ factor: 'property_ownership', value: points, label: 'Verified Ownership/Stability' });
    }

    // 2. Tech Vulnerability (20pts)
    // Using generic email, old website, or no online ordering
    const hasGenericEmail = /@(gmail|yahoo|hotmail|aol)\.com$/i.test(lead.email || '');
    const hasOldTech = !lead.tech_stack || lead.tech_stack.length === 0;

    if (hasGenericEmail || hasOldTech) {
        const points = 10 * SCORING_WEIGHTS.tech_vulnerability;
        score += points;
        factors.push({ factor: 'tech_vulnerability', value: points, label: 'High Tech Upgrade Potential' });
    }

    // 3. Social Presence (10pts)
    // Active social accounts indicate marketing awareness
    if (lead.instagram_handle || lead.facebook_url) {
        const points = 10 * SCORING_WEIGHTS.social_presence;
        score += points;
        factors.push({ factor: 'social_presence', value: points, label: 'Active Social Marketing' });
    }

    // 4. Menu Complexity (20pts)
    // Large menus or frequent changes benefit from our Menu Engine
    if (lead.menu_item_count && lead.menu_item_count > 30) {
        const points = 10 * SCORING_WEIGHTS.menu_complexity;
        score += points;
        factors.push({ factor: 'menu_complexity', value: points, label: 'Complex Menu Management' });
    }

    // 5. Price Point (10pts)
    // Higher price points often mean better budget for consulting
    if (lead.price_range === '$$$' || lead.price_range === '$$$$') {
        const points = 10 * SCORING_WEIGHTS.price_point;
        score += points;
        factors.push({ factor: 'price_point', value: points, label: 'Premium Pricing Tier' });
    }

    // 6. Intent / Engagement (Bonus 10pts)
    if (lead.interactions_count > 0 || lead.email_opens > 0) {
        score += 10;
        factors.push({ factor: 'engagement', value: 10, label: 'Demonstrated Interest' });
    }

    return {
        score: Math.min(100, score),
        factors,
        lastCalculated: Math.floor(Date.now() / 1000)
    };
}
