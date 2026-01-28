/**
 * Content to SEO Transformer - Restaurant Wrap Pipeline
 * 
 * Transforms aggregated content into SEO-optimized blog post briefs:
 * - AI-generated summaries of key points
 * - Keyword extraction and optimization
 * - Meta title/description suggestions
 * - Content structure recommendations
 * - Internal linking opportunities
 * 
 * Usage:
 *   npx tsx scripts/restaurant-wrap/content-to-seo.ts
 *   npx tsx scripts/restaurant-wrap/content-to-seo.ts --input=./data/restaurant-wrap-2026-01-27.json
 *   npx tsx scripts/restaurant-wrap/content-to-seo.ts --ai-enhance
 */

import { ScoredContent } from './restaurant-wrap-aggregator';

// ============================================
// TYPES
// ============================================

interface SEOBlogBrief {
  id: string;
  sourceContent: {
    title: string;
    url: string;
    source: string;
    excerpt: string | null;
  };
  
  // SEO Optimization
  seo: {
    primaryKeyword: string;
    secondaryKeywords: string[];
    longTailKeywords: string[];
    metaTitle: string;
    metaDescription: string;
    suggestedSlug: string;
    targetWordCount: { min: number; max: number };
    searchIntent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  };
  
  // Content Structure
  structure: {
    headline: string;
    subheadlines: string[];
    suggestedSections: string[];
    ctaPlacement: string[];
    internalLinks: { anchor: string; targetPage: string }[];
  };
  
  // AI Summary
  summary: {
    keyPoints: string[];
    expertAngle: string;
    uniqueValue: string;
    targetAudience: string;
  };
  
  // Publishing
  publishing: {
    suggestedCategory: string;
    suggestedTags: string[];
    priority: 'high' | 'medium' | 'low';
    estimatedEffort: 'quick' | 'standard' | 'deep-dive';
    timeliness: 'evergreen' | 'trending' | 'time-sensitive';
  };
  
  // Scores
  scores: {
    seoOpportunity: number;
    contentGap: number;
    competitiveDifficulty: number;
    overallPriority: number;
  };
  
  createdAt: string;
}

interface ContentQueueEntry {
  id: string;
  brief: SEOBlogBrief;
  status: 'pending' | 'in_review' | 'writing' | 'editing' | 'approved' | 'published' | 'rejected';
  assignedTo: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// KEYWORD DATABASE
// ============================================

const KEYWORD_DATABASE = {
  // Primary target keywords with search volume estimates
  primary: [
    { keyword: 'toast pos consultant', volume: 'low', difficulty: 'low', intent: 'commercial' },
    { keyword: 'toast pos setup', volume: 'medium', difficulty: 'medium', intent: 'informational' },
    { keyword: 'toast pos training', volume: 'medium', difficulty: 'low', intent: 'commercial' },
    { keyword: 'restaurant pos system', volume: 'high', difficulty: 'high', intent: 'commercial' },
    { keyword: 'toast pos vs clover', volume: 'medium', difficulty: 'medium', intent: 'commercial' },
    { keyword: 'toast pos vs square', volume: 'medium', difficulty: 'medium', intent: 'commercial' },
    { keyword: 'toast online ordering', volume: 'medium', difficulty: 'medium', intent: 'informational' },
    { keyword: 'toast kitchen display', volume: 'low', difficulty: 'low', intent: 'informational' },
    { keyword: 'restaurant technology consulting', volume: 'low', difficulty: 'low', intent: 'commercial' },
    { keyword: 'toast pos integration', volume: 'low', difficulty: 'low', intent: 'informational' },
  ],
  
  // Long-tail variations
  longTail: [
    'how to set up toast pos for new restaurant',
    'toast pos menu engineering best practices',
    'toast doordash integration setup guide',
    'toast kitchen display system troubleshooting',
    'switching from square to toast pos',
    'toast pos hardware requirements',
    'toast pos employee training tips',
    'toast tableside ordering setup',
    'toast loyalty program configuration',
    'toast pos reporting and analytics',
    'toast payroll integration setup',
    'cape cod restaurant pos consultant',
  ],
  
  // Topic clusters
  clusters: {
    'Toast Setup': ['toast pos setup', 'toast hardware', 'toast installation', 'toast configuration'],
    'Toast Training': ['toast pos training', 'toast employee training', 'toast manager training'],
    'Online Ordering': ['toast online ordering', 'toast delivery integration', 'toast doordash', 'toast uber eats'],
    'Kitchen Operations': ['toast kds', 'toast kitchen display', 'toast kitchen efficiency'],
    'POS Comparison': ['toast vs clover', 'toast vs square', 'toast vs lightspeed', 'best restaurant pos'],
    'Payment Processing': ['toast payment processing', 'toast credit card fees', 'toast payment terminal'],
    'Menu Management': ['toast menu engineering', 'toast menu setup', 'toast modifiers'],
  }
};

// ============================================
// CONTENT CATEGORIES
// ============================================

const CONTENT_CATEGORIES = {
  'Toast Guides': {
    keywords: ['toast', 'toasttab', 'setup', 'configure', 'guide', 'tutorial'],
    ctaType: 'consultation'
  },
  'POS Comparisons': {
    keywords: ['vs', 'compare', 'comparison', 'clover', 'square', 'lightspeed'],
    ctaType: 'assessment'
  },
  'Industry News': {
    keywords: ['news', 'update', 'announcement', 'release', 'feature'],
    ctaType: 'newsletter'
  },
  'Troubleshooting': {
    keywords: ['fix', 'problem', 'issue', 'error', 'troubleshoot', 'help'],
    ctaType: 'support'
  },
  'Best Practices': {
    keywords: ['tips', 'best practice', 'optimize', 'improve', 'efficiency'],
    ctaType: 'consultation'
  },
  'Case Studies': {
    keywords: ['success', 'result', 'case study', 'example', 'testimonial'],
    ctaType: 'demo'
  }
};

// ============================================
// INTERNAL LINK TARGETS
// ============================================

const INTERNAL_PAGES = [
  { page: '/services', keywords: ['consulting', 'services', 'help', 'support', 'professional'] },
  { page: '/services/toast-setup', keywords: ['setup', 'installation', 'configuration', 'implement'] },
  { page: '/services/training', keywords: ['training', 'learn', 'staff', 'employee', 'education'] },
  { page: '/services/menu-engineering', keywords: ['menu', 'engineering', 'optimization', 'pricing'] },
  { page: '/contact', keywords: ['contact', 'quote', 'consultation', 'talk', 'call'] },
  { page: '/about', keywords: ['expert', 'experience', 'team', 'about', 'who'] },
  { page: '/blog', keywords: ['more', 'read', 'articles', 'guides', 'resources'] },
  { page: '/faq', keywords: ['question', 'faq', 'answer', 'common'] },
];

// ============================================
// TRANSFORMATION FUNCTIONS
// ============================================

function extractPrimaryKeyword(content: ScoredContent): string {
  const titleLower = content.title.toLowerCase();
  const textLower = `${content.title} ${content.excerpt || ''}`.toLowerCase();
  
  // Check against primary keywords
  for (const { keyword } of KEYWORD_DATABASE.primary) {
    if (textLower.includes(keyword)) {
      return keyword;
    }
  }
  
  // Check keyword matches from aggregator
  if (content.keywordMatches.length > 0) {
    // Prefer Toast-related keywords
    const toastKeyword = content.keywordMatches.find(k => k.includes('toast'));
    if (toastKeyword) return toastKeyword;
    
    // Prefer POS-related keywords
    const posKeyword = content.keywordMatches.find(k => k.includes('pos'));
    if (posKeyword) return posKeyword;
    
    return content.keywordMatches[0];
  }
  
  // Fallback to topic extraction
  if (titleLower.includes('toast')) return 'toast pos';
  if (titleLower.includes('restaurant')) return 'restaurant pos';
  
  return 'restaurant technology';
}

function extractSecondaryKeywords(content: ScoredContent, primaryKeyword: string): string[] {
  const keywords: string[] = [];
  const textLower = `${content.title} ${content.excerpt || ''} ${content.content || ''}`.toLowerCase();
  
  // Add from keyword matches (excluding primary)
  for (const kw of content.keywordMatches) {
    if (kw !== primaryKeyword && keywords.length < 5) {
      keywords.push(kw);
    }
  }
  
  // Check primary database
  for (const { keyword } of KEYWORD_DATABASE.primary) {
    if (keyword !== primaryKeyword && textLower.includes(keyword) && !keywords.includes(keyword)) {
      keywords.push(keyword);
      if (keywords.length >= 5) break;
    }
  }
  
  return keywords;
}

function findLongTailKeywords(content: ScoredContent, primaryKeyword: string): string[] {
  const keywords: string[] = [];
  const textLower = `${content.title} ${content.excerpt || ''} ${content.content || ''}`.toLowerCase();
  
  for (const longTail of KEYWORD_DATABASE.longTail) {
    // Check if content relates to this long-tail keyword
    const words = longTail.split(' ');
    const matchCount = words.filter(w => textLower.includes(w)).length;
    
    if (matchCount >= Math.ceil(words.length * 0.5)) {
      keywords.push(longTail);
      if (keywords.length >= 3) break;
    }
  }
  
  return keywords;
}

function generateMetaTitle(content: ScoredContent, primaryKeyword: string): string {
  const title = content.title;
  
  // If title already contains keyword and is good length, use it
  if (title.toLowerCase().includes(primaryKeyword.toLowerCase()) && title.length <= 60) {
    return title;
  }
  
  // Append keyword context if missing
  let metaTitle = title;
  
  if (!title.toLowerCase().includes('toast') && primaryKeyword.includes('toast')) {
    metaTitle = `${title} | Toast POS Guide`;
  } else if (!title.toLowerCase().includes('pos') && primaryKeyword.includes('pos')) {
    metaTitle = `${title} | Restaurant POS`;
  }
  
  // Truncate if too long
  if (metaTitle.length > 60) {
    metaTitle = metaTitle.substring(0, 57) + '...';
  }
  
  return metaTitle;
}

function generateMetaDescription(content: ScoredContent, primaryKeyword: string): string {
  // Start with excerpt if available
  let description = content.excerpt || content.title;
  
  // Ensure keyword is in description
  if (!description.toLowerCase().includes(primaryKeyword.toLowerCase())) {
    description = `Learn about ${primaryKeyword}. ${description}`;
  }
  
  // Add CTA hint
  if (!description.includes('consultant') && !description.includes('expert')) {
    description += ' Get expert consulting help.';
  }
  
  // Truncate to 155 chars
  if (description.length > 155) {
    description = description.substring(0, 152) + '...';
  }
  
  return description;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function detectSearchIntent(content: ScoredContent): 'informational' | 'commercial' | 'transactional' | 'navigational' {
  const textLower = `${content.title} ${content.excerpt || ''}`.toLowerCase();
  
  // Transactional signals
  if (textLower.includes('buy') || textLower.includes('price') || textLower.includes('cost') || textLower.includes('quote')) {
    return 'transactional';
  }
  
  // Commercial signals
  if (textLower.includes('best') || textLower.includes('vs') || textLower.includes('compare') || textLower.includes('review')) {
    return 'commercial';
  }
  
  // Navigational signals
  if (textLower.includes('login') || textLower.includes('sign in') || textLower.includes('support')) {
    return 'navigational';
  }
  
  // Default to informational
  return 'informational';
}

function categorizeContent(content: ScoredContent): string {
  const textLower = `${content.title} ${content.excerpt || ''}`.toLowerCase();
  
  for (const [category, config] of Object.entries(CONTENT_CATEGORIES)) {
    const matchCount = config.keywords.filter(kw => textLower.includes(kw)).length;
    if (matchCount >= 2) {
      return category;
    }
  }
  
  return 'General';
}

function suggestSections(content: ScoredContent, searchIntent: string): string[] {
  const sections: string[] = [];
  
  // Standard sections based on intent
  switch (searchIntent) {
    case 'informational':
      sections.push('Introduction', 'Key Concepts', 'Step-by-Step Guide', 'Best Practices', 'Conclusion');
      break;
    case 'commercial':
      sections.push('Overview', 'Feature Comparison', 'Pros and Cons', 'Pricing Considerations', 'Our Recommendation');
      break;
    case 'transactional':
      sections.push('Quick Summary', 'Pricing Options', 'What\'s Included', 'Next Steps', 'FAQ');
      break;
    default:
      sections.push('Introduction', 'Main Content', 'Summary', 'Related Resources');
  }
  
  // Add topic-specific sections
  const textLower = content.title.toLowerCase();
  if (textLower.includes('setup') || textLower.includes('install')) {
    sections.splice(2, 0, 'Requirements', 'Installation Steps', 'Troubleshooting');
  }
  if (textLower.includes('vs') || textLower.includes('compare')) {
    sections.splice(1, 0, 'Quick Comparison Table');
  }
  
  return sections;
}

function suggestSubheadlines(content: ScoredContent, primaryKeyword: string): string[] {
  const headlines: string[] = [];
  const topic = content.suggestedTopics[0] || 'Restaurant Technology';
  
  // Generate contextual subheadlines
  headlines.push(`Understanding ${primaryKeyword.charAt(0).toUpperCase() + primaryKeyword.slice(1)}`);
  headlines.push(`Why ${topic} Matters for Your Restaurant`);
  headlines.push(`How to Get Started with ${primaryKeyword}`);
  headlines.push(`Common ${topic} Mistakes to Avoid`);
  headlines.push(`Expert Tips for ${topic} Success`);
  
  return headlines.slice(0, 4);
}

function findInternalLinks(content: ScoredContent): { anchor: string; targetPage: string }[] {
  const links: { anchor: string; targetPage: string }[] = [];
  const textLower = `${content.title} ${content.excerpt || ''} ${content.content || ''}`.toLowerCase();
  
  for (const page of INTERNAL_PAGES) {
    const matchCount = page.keywords.filter(kw => textLower.includes(kw)).length;
    if (matchCount >= 1) {
      // Find best anchor text
      const anchor = page.keywords.find(kw => textLower.includes(kw)) || page.keywords[0];
      links.push({
        anchor: anchor + ' services',
        targetPage: page.page
      });
    }
  }
  
  return links.slice(0, 3);
}

function extractKeyPoints(content: ScoredContent): string[] {
  const points: string[] = [];
  
  // Extract from content if available
  if (content.content) {
    // Look for list items
    const listItems = content.content.match(/[•\-\*]\s*([^\n]+)/g) || [];
    for (const item of listItems.slice(0, 3)) {
      points.push(item.replace(/^[•\-\*]\s*/, '').trim());
    }
  }
  
  // Add points based on keywords
  if (content.keywordMatches.length > 0) {
    points.push(`Key focus: ${content.keywordMatches.slice(0, 3).join(', ')}`);
  }
  
  // Add topic-based points
  for (const topic of content.suggestedTopics.slice(0, 2)) {
    points.push(`Covers ${topic} considerations`);
  }
  
  // Ensure at least 3 points
  while (points.length < 3) {
    points.push('Practical insights for restaurant operators');
  }
  
  return points.slice(0, 5);
}

function calculateScores(content: ScoredContent, category: string): {
  seoOpportunity: number;
  contentGap: number;
  competitiveDifficulty: number;
  overallPriority: number;
} {
  // SEO Opportunity: Based on keyword volume and relevance
  let seoOpportunity = content.seoScore;
  if (content.keywordMatches.some(k => k.includes('toast'))) seoOpportunity += 10;
  if (content.keywordMatches.some(k => k.includes('consultant') || k.includes('setup'))) seoOpportunity += 15;
  seoOpportunity = Math.min(seoOpportunity, 100);
  
  // Content Gap: How well does existing content cover this?
  // Higher score = bigger gap = more opportunity
  let contentGap = 60; // Base assumption
  if (category === 'Troubleshooting') contentGap += 20; // Less covered
  if (content.sourceName.includes('Reddit')) contentGap += 15; // Community pain points
  if (content.trendingScore > 70) contentGap += 10; // New/trending topics
  contentGap = Math.min(contentGap, 100);
  
  // Competitive Difficulty: How hard to rank?
  let competitiveDifficulty = 50;
  if (content.keywordMatches.some(k => k.includes('best') || k.includes('top'))) competitiveDifficulty += 20;
  if (category === 'POS Comparisons') competitiveDifficulty += 15;
  if (content.sourceName.includes('Toast')) competitiveDifficulty += 10; // Official content is hard to outrank
  competitiveDifficulty = Math.min(competitiveDifficulty, 100);
  
  // Overall Priority
  const overallPriority = Math.round(
    (seoOpportunity * 0.35) +
    (contentGap * 0.35) +
    ((100 - competitiveDifficulty) * 0.3)
  );
  
  return {
    seoOpportunity,
    contentGap,
    competitiveDifficulty,
    overallPriority
  };
}

function determineEstimatedEffort(content: ScoredContent, searchIntent: string): 'quick' | 'standard' | 'deep-dive' {
  if (searchIntent === 'informational' && (content.content?.length || 0) < 500) {
    return 'quick';
  }
  if (searchIntent === 'commercial' || content.title.toLowerCase().includes('compare')) {
    return 'deep-dive';
  }
  return 'standard';
}

function determineTimeliness(content: ScoredContent): 'evergreen' | 'trending' | 'time-sensitive' {
  const textLower = `${content.title} ${content.excerpt || ''}`.toLowerCase();
  
  if (content.trendingScore > 80) return 'trending';
  if (textLower.includes('update') || textLower.includes('new') || textLower.includes('announce')) {
    return 'time-sensitive';
  }
  return 'evergreen';
}

// ============================================
// MAIN TRANSFORM FUNCTION
// ============================================

export function transformToSEOBrief(content: ScoredContent): SEOBlogBrief {
  const primaryKeyword = extractPrimaryKeyword(content);
  const secondaryKeywords = extractSecondaryKeywords(content, primaryKeyword);
  const longTailKeywords = findLongTailKeywords(content, primaryKeyword);
  const searchIntent = detectSearchIntent(content);
  const category = categorizeContent(content);
  const scores = calculateScores(content, category);
  
  const brief: SEOBlogBrief = {
    id: `seo_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    
    sourceContent: {
      title: content.title,
      url: content.externalUrl,
      source: content.sourceName,
      excerpt: content.excerpt
    },
    
    seo: {
      primaryKeyword,
      secondaryKeywords,
      longTailKeywords,
      metaTitle: generateMetaTitle(content, primaryKeyword),
      metaDescription: generateMetaDescription(content, primaryKeyword),
      suggestedSlug: generateSlug(content.title),
      targetWordCount: searchIntent === 'informational' 
        ? { min: 1200, max: 2000 } 
        : { min: 800, max: 1500 },
      searchIntent
    },
    
    structure: {
      headline: content.title,
      subheadlines: suggestSubheadlines(content, primaryKeyword),
      suggestedSections: suggestSections(content, searchIntent),
      ctaPlacement: ['After introduction', 'Mid-article', 'Conclusion'],
      internalLinks: findInternalLinks(content)
    },
    
    summary: {
      keyPoints: extractKeyPoints(content),
      expertAngle: `R&G Consulting perspective on ${primaryKeyword} implementation and optimization`,
      uniqueValue: `Hands-on experience with Toast POS deployments in Cape Cod restaurants`,
      targetAudience: 'Restaurant owners and managers considering or using Toast POS'
    },
    
    publishing: {
      suggestedCategory: category,
      suggestedTags: [...content.suggestedTopics, ...content.tags.slice(0, 3)],
      priority: scores.overallPriority > 70 ? 'high' : scores.overallPriority > 50 ? 'medium' : 'low',
      estimatedEffort: determineEstimatedEffort(content, searchIntent),
      timeliness: determineTimeliness(content)
    },
    
    scores,
    
    createdAt: new Date().toISOString()
  };
  
  return brief;
}

// ============================================
// BATCH TRANSFORM FUNCTION
// ============================================

export function transformBatchToSEOBriefs(
  items: ScoredContent[],
  options: {
    minPriority?: number;
    maxItems?: number;
    priorityOnly?: boolean;
  } = {}
): SEOBlogBrief[] {
  const {
    minPriority = 40,
    maxItems = 20,
    priorityOnly = false
  } = options;
  
  let briefs = items.map(item => transformToSEOBrief(item));
  
  // Filter by priority if requested
  if (priorityOnly || minPriority > 0) {
    briefs = briefs.filter(b => b.scores.overallPriority >= minPriority);
  }
  
  // Sort by priority
  briefs.sort((a, b) => b.scores.overallPriority - a.scores.overallPriority);
  
  // Limit results
  return briefs.slice(0, maxItems);
}

// ============================================
// CONTENT QUEUE MANAGEMENT
// ============================================

export function createQueueEntry(brief: SEOBlogBrief): ContentQueueEntry {
  return {
    id: `queue_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    brief,
    status: 'pending',
    assignedTo: null,
    reviewNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function formatBriefForDisplay(brief: SEOBlogBrief): string {
  return `
╔════════════════════════════════════════════════════════════════════════════════
║ SEO BLOG BRIEF: ${brief.sourceContent.title.substring(0, 60)}
╠════════════════════════════════════════════════════════════════════════════════
║ 📊 Priority: ${brief.publishing.priority.toUpperCase()} (Score: ${brief.scores.overallPriority})
║ 📂 Category: ${brief.publishing.suggestedCategory}
║ ⏱️  Effort: ${brief.publishing.estimatedEffort} | Timeliness: ${brief.publishing.timeliness}
╠────────────────────────────────────────────────────────────────────────────────
║ 🔍 SEO OPTIMIZATION
║    Primary Keyword: ${brief.seo.primaryKeyword}
║    Secondary: ${brief.seo.secondaryKeywords.join(', ')}
║    Long-tail: ${brief.seo.longTailKeywords.join(', ') || 'None identified'}
║    Search Intent: ${brief.seo.searchIntent}
╠────────────────────────────────────────────────────────────────────────────────
║ 📝 META DATA
║    Title: ${brief.seo.metaTitle}
║    Description: ${brief.seo.metaDescription}
║    Slug: /${brief.seo.suggestedSlug}
║    Word Count: ${brief.seo.targetWordCount.min}-${brief.seo.targetWordCount.max}
╠────────────────────────────────────────────────────────────────────────────────
║ 📐 CONTENT STRUCTURE
║    Headline: ${brief.structure.headline}
║    Sections: ${brief.structure.suggestedSections.join(' → ')}
║    CTAs: ${brief.structure.ctaPlacement.join(', ')}
╠────────────────────────────────────────────────────────────────────────────────
║ 💡 KEY POINTS
${brief.summary.keyPoints.map(p => `║    • ${p}`).join('\n')}
╠────────────────────────────────────────────────────────────────────────────────
║ 🔗 INTERNAL LINKS
${brief.structure.internalLinks.map(l => `║    "${l.anchor}" → ${l.targetPage}`).join('\n') || '║    None suggested'}
╠────────────────────────────────────────────────────────────────────────────────
║ 📈 SCORES
║    SEO Opportunity: ${brief.scores.seoOpportunity}/100
║    Content Gap: ${brief.scores.contentGap}/100
║    Competitive Difficulty: ${brief.scores.competitiveDifficulty}/100
╠────────────────────────────────────────────────────────────────────────────────
║ 🏷️  Tags: ${brief.publishing.suggestedTags.join(', ')}
║ 📎 Source: ${brief.sourceContent.source} (${brief.sourceContent.url})
╚════════════════════════════════════════════════════════════════════════════════
`;
}

// ============================================
// CLI ENTRY POINT
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const inputArg = args.find(a => a.startsWith('--input='));
  const inputPath = inputArg 
    ? inputArg.split('=')[1] 
    : `./data/restaurant-wrap-${new Date().toISOString().split('T')[0]}.json`;
  
  const fs = await import('fs');
  
  console.log('\n🔄 Content to SEO Transformer');
  console.log(`   Reading from: ${inputPath}\n`);
  
  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.log('❌ Input file not found. Running aggregator first...\n');
    
    // Import and run aggregator
    const { aggregateContent } = await import('./restaurant-wrap-aggregator');
    const { items } = await aggregateContent({
      minRelevanceScore: 25,
      maxItems: 30
    });
    
    // Transform to SEO briefs
    const briefs = transformBatchToSEOBriefs(items, {
      minPriority: 40,
      maxItems: 10
    });
    
    // Display top briefs
    console.log('\n\n📋 TOP SEO BLOG BRIEFS (By Priority)\n');
    
    for (const brief of briefs.slice(0, 5)) {
      console.log(formatBriefForDisplay(brief));
    }
    
    // Save queue
    const queueEntries = briefs.map(createQueueEntry);
    const outputPath = `./data/content-queue-${new Date().toISOString().split('T')[0]}.json`;
    
    fs.writeFileSync(outputPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalBriefs: briefs.length,
      queue: queueEntries
    }, null, 2));
    
    console.log(`\n💾 Content queue saved to: ${outputPath}`);
    console.log(`   Total briefs generated: ${briefs.length}`);
    
    return;
  }
  
  // Read existing aggregated data
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const items: ScoredContent[] = data.items;
  
  console.log(`   Found ${items.length} aggregated items\n`);
  
  // Transform to SEO briefs
  const briefs = transformBatchToSEOBriefs(items, {
    minPriority: 40,
    maxItems: 10
  });
  
  // Display top briefs
  console.log('\n📋 TOP SEO BLOG BRIEFS (By Priority)\n');
  
  for (const brief of briefs.slice(0, 5)) {
    console.log(formatBriefForDisplay(brief));
  }
  
  // Save queue
  const queueEntries = briefs.map(createQueueEntry);
  const outputPath = `./data/content-queue-${new Date().toISOString().split('T')[0]}.json`;
  
  fs.writeFileSync(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalBriefs: briefs.length,
    queue: queueEntries
  }, null, 2));
  
  console.log(`\n💾 Content queue saved to: ${outputPath}`);
  console.log(`   Total briefs generated: ${briefs.length}`);
  console.log(`   High priority: ${briefs.filter(b => b.publishing.priority === 'high').length}`);
  console.log(`   Medium priority: ${briefs.filter(b => b.publishing.priority === 'medium').length}`);
  console.log(`   Low priority: ${briefs.filter(b => b.publishing.priority === 'low').length}`);
}

// Run if executed directly
main().catch(console.error);

export { SEOBlogBrief, ContentQueueEntry };
