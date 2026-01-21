
/**
 * Client Health Calculation Logic
 * Determines churn risk and satisfaction probability
 */

export function calculateClientHealth(client, tickets = [], revenue = [], usage = {}) {
    let score = 80; // Start with a baseline 'B' grade
    const factors = [];

    // 1. Support Load (Negative impact)
    // Too many tickets or open urgent tickets reduces health
    const openTickets = tickets.filter(t => t.status !== 'resolved');
    const urgentTickets = openTickets.filter(t => t.priority === 'urgent');

    if (urgentTickets.length > 0) {
        const penalty = urgentTickets.length * 15;
        score -= penalty;
        factors.push({ factor: 'urgent_issues', value: -penalty, label: `${urgentTickets.length} Urgent Open Tickets` });
    }

    if (tickets.length > 5 && openTickets.length / tickets.length > 0.5) {
        const penalty = 10;
        score -= penalty;
        factors.push({ factor: 'unresolved_ratio', value: -penalty, label: 'High Ratio of Unresolved Tickets' });
    }

    // 2. Revenue / Payment History (Positive/Negative)
    if (revenue.some(r => r.status === 'overdue')) {
        const penalty = 20;
        score -= penalty;
        factors.push({ factor: 'overdue_payment', value: -penalty, label: 'Overdue Payments' });
    }

    // 3. Plan Tier (Positive)
    if (client.support_plan_tier === 'premium') {
        score += 10;
        factors.push({ factor: 'premium_plan', value: 10, label: 'Premium Support Plan' });
    }

    // 4. Usage / Engagement
    if (usage.last_login_days && usage.last_login_days > 30) {
        const penalty = 10;
        score -= penalty;
        factors.push({ factor: 'low_usage', value: -penalty, label: 'No Login in 30 Days' });
    }

    // Cap score 0-100
    score = Math.max(0, Math.min(100, score));

    let riskLevel = 'low';
    if (score < 40) riskLevel = 'critical';
    else if (score < 60) riskLevel = 'high';
    else if (score < 75) riskLevel = 'medium';

    return {
        score,
        riskLevel,
        factors,
        calculatedAt: Math.floor(Date.now() / 1000)
    };
}
