/**
 * Restaurant Wrap Aggregator - Content Pipeline from Sources to SEO
 * 
 * Aggregates restaurant industry news, trends, and Toast updates from multiple sources:
 * - RSS Feeds (Toast Blog, NRN, Modern Restaurant Management)
 * - Reddit (r/ToastPOS, r/restaurateur, r/KitchenConfidential)
 * - Google Trends keywords (restaurant tech)
 * - Web scraping for competitor news (Clover, Square, Lightspeed)
 * 
 * Usage:
 *   npx tsx scripts/restaurant-wrap/restaurant-wrap-aggregator.ts
 *   npx tsx scripts/restaurant-wrap/restaurant-wrap-aggregator.ts --source=reddit
 *   npx tsx scripts/restaurant-wrap/restaurant-wrap-aggregator.ts --dry-run
 */

import { parse } from 'csv-parse/sync';

// ============================================
// TYPES
// ============================================

interface ContentSource {
  id: string;
  name: string;
  type: 'rss' | 'reddit' | 'scrape' | 'trends' | 'manual';
  url: string;
  category: string;
  relevanceWeight: number; // 1-10, how relevant to consulting business
  enabled: boolean;
}

interface RawContent {
  sourceId: string;
  sourceName: string;
  externalId: string;
  externalUrl: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  author: string | null;
  publishedAt: Date | null;
  category: string;
  tags: string[];
  rawData: Record<string, unknown>;
}

interface ScoredContent extends RawContent {
  relevanceScore: number; // 0-100
  seoScore: number; // 0-100
  trendingScore: number; // 0-100
  overallScore: number; // weighted average
  keywordMatches: string[];
  suggestedTopics: string[];
}

interface ContentQueueItem {
  id: string;
  content: ScoredContent;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'published';
  seoSuggestions: {
    primaryKeyword: string;
    secondaryKeywords: string[];
    metaTitle: string;
    metaDescription: string;
    suggestedHeadlines: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// CONTENT SOURCES CONFIGURATION
// ============================================

export const CONTENT_SOURCES: ContentSource[] = [
  // === PRIMARY: Toast & POS Industry ===
  {
    id: 'toast_blog',
    name: 'Toast Official Blog',
    type: 'rss',
    url: 'https://pos.toasttab.com/blog/rss.xml',
    category: 'toast_official',
    relevanceWeight: 10,
    enabled: true
  },
  {
    id: 'toast_resources',
    name: 'Toast Resources',
    type: 'scrape',
    url: 'https://pos.toasttab.com/resources',
    category: 'toast_official',
    relevanceWeight: 10,
    enabled: true
  },
  
  // === INDUSTRY NEWS ===
  {
    id: 'nrn',
    name: "Nation's Restaurant News",
    type: 'rss',
    url: 'https://www.nrn.com/rss.xml',
    category: 'industry_news',
    relevanceWeight: 8,
    enabled: true
  },
  {
    id: 'mrm',
    name: 'Modern Restaurant Management',
    type: 'rss',
    url: 'https://modernrestaurantmanagement.com/feed/',
    category: 'industry_news',
    relevanceWeight: 8,
    enabled: true
  },
  {
    id: 'rbo',
    name: 'Restaurant Business Online',
    type: 'rss',
    url: 'https://www.restaurantbusinessonline.com/rss.xml',
    category: 'industry_news',
    relevanceWeight: 7,
    enabled: true
  },
  {
    id: 'fsm',
    name: 'Foodservice Equipment Reports',
    type: 'rss',
    url: 'https://fermag.com/feed/',
    category: 'industry_news',
    relevanceWeight: 6,
    enabled: true
  },
  {
    id: 'qsr_magazine',
    name: 'QSR Magazine',
    type: 'rss',
    url: 'https://www.qsrmagazine.com/rss.xml',
    category: 'industry_news',
    relevanceWeight: 7,
    enabled: true
  },
  
  // === COMPETITOR NEWS ===
  {
    id: 'clover_blog',
    name: 'Clover Blog',
    type: 'scrape',
    url: 'https://www.clover.com/blog',
    category: 'competitors',
    relevanceWeight: 9,
    enabled: true
  },
  {
    id: 'square_blog',
    name: 'Square Restaurant Blog',
    type: 'scrape',
    url: 'https://squareup.com/us/en/townsquare/restaurants',
    category: 'competitors',
    relevanceWeight: 9,
    enabled: true
  },
  {
    id: 'lightspeed_blog',
    name: 'Lightspeed Restaurant Blog',
    type: 'scrape',
    url: 'https://www.lightspeedhq.com/blog/restaurant/',
    category: 'competitors',
    relevanceWeight: 8,
    enabled: true
  },
  {
    id: 'touchbistro_blog',
    name: 'TouchBistro Blog',
    type: 'scrape',
    url: 'https://www.touchbistro.com/blog/',
    category: 'competitors',
    relevanceWeight: 7,
    enabled: true
  },
  
  // === REDDIT COMMUNITIES ===
  {
    id: 'reddit_toastpos',
    name: 'r/ToastPOS',
    type: 'reddit',
    url: 'https://www.reddit.com/r/ToastPOS/.json',
    category: 'community',
    relevanceWeight: 10,
    enabled: true
  },
  {
    id: 'reddit_restaurateur',
    name: 'r/restaurateur',
    type: 'reddit',
    url: 'https://www.reddit.com/r/restaurateur/.json',
    category: 'community',
    relevanceWeight: 8,
    enabled: true
  },
  {
    id: 'reddit_kitchenconfidential',
    name: 'r/KitchenConfidential',
    type: 'reddit',
    url: 'https://www.reddit.com/r/KitchenConfidential/.json',
    category: 'community',
    relevanceWeight: 5,
    enabled: true
  },
  {
    id: 'reddit_smallbusiness',
    name: 'r/smallbusiness (restaurant)',
    type: 'reddit',
    url: 'https://www.reddit.com/r/smallbusiness/search.json?q=restaurant+POS&restrict_sr=1&sort=new',
    category: 'community',
    relevanceWeight: 6,
    enabled: true
  },
  
  // === TRENDS ===
  {
    id: 'google_trends',
    name: 'Google Trends - Restaurant Tech',
    type: 'trends',
    url: 'https://trends.google.com/trends/explore?q=toast%20pos,restaurant%20pos,restaurant%20technology',
    category: 'trends',
    relevanceWeight: 7,
    enabled: true
  }
];

// ============================================
// KEYWORD & SCORING CONFIGURATION
// ============================================

export const RELEVANCE_KEYWORDS = {
  // High relevance (10 points each)
  critical: [
    'toast pos', 'toast tab', 'toasttab', 'toast restaurant',
    'pos system', 'point of sale', 'restaurant pos',
    'kitchen display', 'kds', 'online ordering',
    'payment processing', 'credit card processing',
    'restaurant technology', 'restaurant tech',
    'menu management', 'inventory management'
  ],
  
  // Medium relevance (5 points each)
  important: [
    'clover pos', 'square pos', 'lightspeed', 'touchbistro',
    'restaurant software', 'restaurant operations',
    'food cost', 'labor cost', 'restaurant profit',
    'delivery integration', 'doordash', 'uber eats', 'grubhub',
    'staff training', 'employee management',
    'reservation system', 'table management',
    'restaurant owner', 'restaurant manager'
  ],
  
  // Low relevance (2 points each)
  supporting: [
    'restaurant', 'dining', 'hospitality',
    'small business', 'food service', 'catering',
    'bar', 'cafe', 'quick service', 'fast casual',
    'full service', 'fine dining', 'franchise'
  ]
};

export const SEO_KEYWORDS = [
  // Primary target keywords for the consulting business
  'toast pos consultant',
  'toast pos setup',
  'toast pos training',
  'restaurant pos consulting',
  'toast implementation',
  'toast menu engineering',
  'toast kitchen display setup',
  'restaurant technology consulting',
  'cape cod restaurant consulting',
  'toast third party integration',
  'toast doordash integration',
  'toast online ordering setup'
];

// ============================================
// RSS PARSER
// ============================================

async function fetchRSS(source: ContentSource): Promise<RawContent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RestaurantWrap-Aggregator/1.0 (R&G Consulting)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const xml = await response.text();
    return parseRSSXml(xml, source);
  } finally {
    clearTimeout(timeout);
  }
}

function parseRSSXml(xml: string, source: ContentSource): RawContent[] {
  const items: RawContent[] = [];
  
  // Try RSS 2.0 format first
  const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
  
  for (const itemXml of itemMatches) {
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid');
    const description = extractTag(itemXml, 'description') || extractTag(itemXml, 'content:encoded');
    const author = extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator');
    const pubDate = extractTag(itemXml, 'pubDate');
    const categories = extractAllTags(itemXml, 'category');
    const guid = extractTag(itemXml, 'guid') || link;
    
    if (!title || !link) continue;
    
    items.push({
      sourceId: source.id,
      sourceName: source.name,
      externalId: guid || link,
      externalUrl: link,
      title: stripHtml(title),
      excerpt: description ? truncate(stripHtml(description), 300) : null,
      content: description ? stripHtml(description) : null,
      author: author ? stripHtml(author) : null,
      publishedAt: pubDate ? new Date(pubDate) : null,
      category: source.category,
      tags: categories.map(c => stripHtml(c).toLowerCase()),
      rawData: { xml: itemXml }
    });
  }
  
  // Fallback to Atom format
  if (items.length === 0) {
    const entryMatches = xml.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi) || [];
    
    for (const entryXml of entryMatches) {
      const title = extractTag(entryXml, 'title');
      const link = extractAtomLink(entryXml);
      const summary = extractTag(entryXml, 'summary') || extractTag(entryXml, 'content');
      const author = extractTag(entryXml, 'name');
      const published = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated');
      const id = extractTag(entryXml, 'id') || link;
      
      if (!title || !link) continue;
      
      items.push({
        sourceId: source.id,
        sourceName: source.name,
        externalId: id || link,
        externalUrl: link,
        title: stripHtml(title),
        excerpt: summary ? truncate(stripHtml(summary), 300) : null,
        content: summary ? stripHtml(summary) : null,
        author: author ? stripHtml(author) : null,
        publishedAt: published ? new Date(published) : null,
        category: source.category,
        tags: [],
        rawData: { xml: entryXml }
      });
    }
  }
  
  return items;
}

// ============================================
// REDDIT PARSER
// ============================================

async function fetchReddit(source: ContentSource): Promise<RawContent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RestaurantWrap-Aggregator/1.0 (by /u/rg-consulting)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    const posts = data.data?.children || [];
    
    return posts.map((post: any) => {
      const d = post.data;
      return {
        sourceId: source.id,
        sourceName: source.name,
        externalId: d.id,
        externalUrl: `https://reddit.com${d.permalink}`,
        title: d.title,
        excerpt: d.selftext ? truncate(d.selftext, 300) : null,
        content: d.selftext || null,
        author: d.author,
        publishedAt: new Date(d.created_utc * 1000),
        category: source.category,
        tags: [d.link_flair_text?.toLowerCase()].filter(Boolean),
        rawData: {
          score: d.score,
          numComments: d.num_comments,
          upvoteRatio: d.upvote_ratio,
          subreddit: d.subreddit
        }
      };
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================
// WEB SCRAPER (Basic)
// ============================================

async function fetchScrape(source: ContentSource): Promise<RawContent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract article links and titles from common patterns
    const articles: RawContent[] = [];
    
    // Pattern 1: <article> tags with <a> and <h2/h3>
    const articleMatches = html.match(/<article[^>]*>[\s\S]*?<\/article>/gi) || [];
    
    for (const articleHtml of articleMatches.slice(0, 10)) {
      const titleMatch = articleHtml.match(/<h[1-3][^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i) ||
                         articleHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i);
      
      if (titleMatch) {
        const [, url, title] = titleMatch;
        const fullUrl = url.startsWith('http') ? url : new URL(url, source.url).href;
        
        // Extract excerpt
        const excerptMatch = articleHtml.match(/<p[^>]*class=["'][^"']*(?:excerpt|summary|desc)[^"']*["'][^>]*>([^<]+)<\/p>/i) ||
                            articleHtml.match(/<p[^>]*>([^<]{50,})<\/p>/i);
        
        articles.push({
          sourceId: source.id,
          sourceName: source.name,
          externalId: fullUrl,
          externalUrl: fullUrl,
          title: stripHtml(title).trim(),
          excerpt: excerptMatch ? truncate(stripHtml(excerptMatch[1]), 300) : null,
          content: null,
          author: null,
          publishedAt: null,
          category: source.category,
          tags: [],
          rawData: { scrapeSource: source.url }
        });
      }
    }
    
    // Pattern 2: Blog post listing with <a> tags
    if (articles.length === 0) {
      const linkMatches = html.match(/<a[^>]*href=["']([^"']*(?:blog|post|article)[^"']*)["'][^>]*>([^<]+)<\/a>/gi) || [];
      
      for (const match of linkMatches.slice(0, 10)) {
        const linkMatch = match.match(/href=["']([^"']+)["'][^>]*>([^<]+)</i);
        if (linkMatch) {
          const [, url, title] = linkMatch;
          const fullUrl = url.startsWith('http') ? url : new URL(url, source.url).href;
          
          articles.push({
            sourceId: source.id,
            sourceName: source.name,
            externalId: fullUrl,
            externalUrl: fullUrl,
            title: stripHtml(title).trim(),
            excerpt: null,
            content: null,
            author: null,
            publishedAt: null,
            category: source.category,
            tags: [],
            rawData: { scrapeSource: source.url }
          });
        }
      }
    }
    
    return articles;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================
// CONTENT SCORING
// ============================================

function scoreContent(content: RawContent): ScoredContent {
  const textToScore = `${content.title} ${content.excerpt || ''} ${content.content || ''}`.toLowerCase();
  
  // Calculate relevance score
  let relevanceScore = 0;
  const keywordMatches: string[] = [];
  
  for (const keyword of RELEVANCE_KEYWORDS.critical) {
    if (textToScore.includes(keyword.toLowerCase())) {
      relevanceScore += 10;
      keywordMatches.push(keyword);
    }
  }
  
  for (const keyword of RELEVANCE_KEYWORDS.important) {
    if (textToScore.includes(keyword.toLowerCase())) {
      relevanceScore += 5;
      keywordMatches.push(keyword);
    }
  }
  
  for (const keyword of RELEVANCE_KEYWORDS.supporting) {
    if (textToScore.includes(keyword.toLowerCase())) {
      relevanceScore += 2;
      keywordMatches.push(keyword);
    }
  }
  
  // Cap at 100
  relevanceScore = Math.min(relevanceScore, 100);
  
  // Calculate SEO score
  let seoScore = 50; // Base score
  
  // Title optimization
  if (content.title.length >= 30 && content.title.length <= 60) seoScore += 15;
  if (content.title.includes('how to') || content.title.includes('guide') || content.title.includes('tips')) seoScore += 10;
  if (/\d/.test(content.title)) seoScore += 5; // Numbers in title
  
  // Content quality
  if (content.content && content.content.length > 500) seoScore += 10;
  if (content.excerpt && content.excerpt.length > 100) seoScore += 5;
  
  // SEO keyword matches
  for (const keyword of SEO_KEYWORDS) {
    if (textToScore.includes(keyword.toLowerCase())) {
      seoScore += 5;
    }
  }
  
  seoScore = Math.min(seoScore, 100);
  
  // Calculate trending score (based on recency and engagement)
  let trendingScore = 50;
  
  if (content.publishedAt) {
    const daysOld = (Date.now() - content.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld < 1) trendingScore += 30;
    else if (daysOld < 3) trendingScore += 20;
    else if (daysOld < 7) trendingScore += 10;
    else if (daysOld > 30) trendingScore -= 20;
  }
  
  // Reddit engagement boost
  if (content.rawData.score && typeof content.rawData.score === 'number') {
    if (content.rawData.score > 100) trendingScore += 20;
    else if (content.rawData.score > 50) trendingScore += 10;
    else if (content.rawData.score > 10) trendingScore += 5;
  }
  
  trendingScore = Math.max(0, Math.min(trendingScore, 100));
  
  // Suggest topics based on keywords
  const suggestedTopics: string[] = [];
  if (keywordMatches.some(k => k.includes('toast'))) suggestedTopics.push('Toast POS');
  if (keywordMatches.some(k => k.includes('online ordering') || k.includes('delivery'))) suggestedTopics.push('Online Ordering');
  if (keywordMatches.some(k => k.includes('kitchen') || k.includes('kds'))) suggestedTopics.push('Kitchen Display');
  if (keywordMatches.some(k => k.includes('payment') || k.includes('credit card'))) suggestedTopics.push('Payment Processing');
  if (keywordMatches.some(k => k.includes('menu') || k.includes('inventory'))) suggestedTopics.push('Menu Management');
  if (keywordMatches.some(k => k.includes('clover') || k.includes('square') || k.includes('lightspeed'))) suggestedTopics.push('POS Comparison');
  
  // Calculate overall score with weights
  const overallScore = Math.round(
    (relevanceScore * 0.4) +
    (seoScore * 0.35) +
    (trendingScore * 0.25)
  );
  
  return {
    ...content,
    relevanceScore,
    seoScore,
    trendingScore,
    overallScore,
    keywordMatches: Array.from(new Set(keywordMatches)),
    suggestedTopics: Array.from(new Set(suggestedTopics))
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function extractTag(xml: string, tagName: string): string | null {
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];
  
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function extractAllTags(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

function extractAtomLink(xml: string): string | null {
  const alternateMatch = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (alternateMatch) return alternateMatch[1];
  
  const anyMatch = xml.match(/<link[^>]*href=["']([^"']+)["']/i);
  return anyMatch ? anyMatch[1] : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function generateId(): string {
  return `wrap_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================
// MAIN AGGREGATION FUNCTION
// ============================================

export async function aggregateContent(
  options: {
    sources?: string[];
    minRelevanceScore?: number;
    maxItems?: number;
    dryRun?: boolean;
  } = {}
): Promise<{
  items: ScoredContent[];
  stats: {
    sourcesProcessed: number;
    itemsFetched: number;
    itemsScored: number;
    itemsFiltered: number;
    errors: string[];
  };
}> {
  const {
    sources: sourceFilter,
    minRelevanceScore = 30,
    maxItems = 100,
    dryRun = false
  } = options;
  
  const stats = {
    sourcesProcessed: 0,
    itemsFetched: 0,
    itemsScored: 0,
    itemsFiltered: 0,
    errors: [] as string[]
  };
  
  const allItems: ScoredContent[] = [];
  
  // Filter sources if specified
  const activeSources = sourceFilter
    ? CONTENT_SOURCES.filter(s => s.enabled && sourceFilter.includes(s.type))
    : CONTENT_SOURCES.filter(s => s.enabled);
  
  console.log(`\n📰 Restaurant Wrap Aggregator`);
  console.log(`   Processing ${activeSources.length} sources...`);
  console.log(`   Min relevance score: ${minRelevanceScore}`);
  console.log(`   Max items: ${maxItems}`);
  console.log(`   Dry run: ${dryRun}\n`);
  
  for (const source of activeSources) {
    console.log(`\n→ Fetching: ${source.name} (${source.type})`);
    
    try {
      let rawItems: RawContent[] = [];
      
      switch (source.type) {
        case 'rss':
          rawItems = await fetchRSS(source);
          break;
        case 'reddit':
          rawItems = await fetchReddit(source);
          break;
        case 'scrape':
          rawItems = await fetchScrape(source);
          break;
        case 'trends':
          // Trends require API key - placeholder for now
          console.log(`   ⚠ Skipping trends source (requires API key)`);
          continue;
        default:
          console.log(`   ⚠ Unknown source type: ${source.type}`);
          continue;
      }
      
      stats.itemsFetched += rawItems.length;
      console.log(`   ✓ Fetched ${rawItems.length} items`);
      
      // Score each item
      for (const item of rawItems) {
        const scored = scoreContent(item);
        stats.itemsScored++;
        
        // Filter by relevance
        if (scored.relevanceScore >= minRelevanceScore) {
          allItems.push(scored);
        } else {
          stats.itemsFiltered++;
        }
      }
      
      stats.sourcesProcessed++;
      
    } catch (error) {
      const errorMsg = `${source.name}: ${error instanceof Error ? error.message : String(error)}`;
      stats.errors.push(errorMsg);
      console.log(`   ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Sort by overall score and limit
  allItems.sort((a, b) => b.overallScore - a.overallScore);
  const topItems = allItems.slice(0, maxItems);
  
  console.log(`\n📊 Aggregation Complete`);
  console.log(`   Sources processed: ${stats.sourcesProcessed}`);
  console.log(`   Items fetched: ${stats.itemsFetched}`);
  console.log(`   Items scored: ${stats.itemsScored}`);
  console.log(`   Items filtered (low relevance): ${stats.itemsFiltered}`);
  console.log(`   Items returned: ${topItems.length}`);
  console.log(`   Errors: ${stats.errors.length}`);
  
  return {
    items: topItems,
    stats
  };
}

// ============================================
// CLI ENTRY POINT
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sourceArg = args.find(a => a.startsWith('--source='));
  const sources = sourceArg ? [sourceArg.split('=')[1]] : undefined;
  
  const { items, stats } = await aggregateContent({
    sources,
    minRelevanceScore: 25,
    maxItems: 50,
    dryRun
  });
  
  // Output top items
  console.log(`\n\n🏆 Top 10 Content Items by Score:\n`);
  console.log('─'.repeat(80));
  
  for (const item of items.slice(0, 10)) {
    console.log(`\n📄 ${item.title}`);
    console.log(`   Source: ${item.sourceName}`);
    console.log(`   URL: ${item.externalUrl}`);
    console.log(`   Scores: Overall=${item.overallScore} | Relevance=${item.relevanceScore} | SEO=${item.seoScore} | Trending=${item.trendingScore}`);
    console.log(`   Keywords: ${item.keywordMatches.slice(0, 5).join(', ')}`);
    console.log(`   Topics: ${item.suggestedTopics.join(', ') || 'General'}`);
    if (item.excerpt) {
      console.log(`   Excerpt: ${item.excerpt.substring(0, 150)}...`);
    }
  }
  
  // Save results to file
  const outputPath = `./data/restaurant-wrap-${new Date().toISOString().split('T')[0]}.json`;
  const fs = await import('fs');
  const path = await import('path');
  
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    stats,
    items: items.slice(0, 50)
  }, null, 2));
  
  console.log(`\n\n💾 Results saved to: ${outputPath}`);
}

// Run if executed directly
main().catch(console.error);

export { RawContent, ScoredContent, ContentQueueItem };
