# Toast Hub Content Platform Plan
## Knowledge Base and Content Marketing
**Created:** January 26, 2026
**Priority:** MEDIUM (Content gap)
**Status:** ✅ COMPLETED - January 26, 2026

---

## Executive Summary

Toast Hub is the content marketing arm of R&G Consulting, intended as a knowledge hub for restaurant operators using Toast POS. The infrastructure is fully built but contains **zero published content**.

**Current State (AFTER IMPLEMENTATION):**
- ✅ Article CMS with 5 foundational articles published
- ✅ FAQ section expanded to 30 questions
- ✅ 8 content categories organized
- ✅ AI content pipeline via Claude API
- ✅ Newsletter subscription with welcome email
- Feature flag remains OFF (ready for manual enablement)

---

## Issues from Platform Audit

| ID | Severity | Issue |
|----|----------|-------|
| TH-1 | MEDIUM | Toast Hub has zero articles |

---

## Infrastructure Analysis

### Existing Components

**Database Tables (from migrations):**
- `articles` - Article storage
- `article_categories` - Category taxonomy
- `article_tags` - Tagging system
- `article_views` - Analytics
- `faqs` - FAQ entries

**Frontend Components:**
- `pages/ToastHub.tsx` - Public hub page
- `src/components/hub/ArticleCard.tsx`
- `src/components/hub/ArticleList.tsx`
- `src/components/hub/FAQSection.tsx`

**API Endpoints:**
- `functions/api/hub/articles.js` - Article CRUD
- `functions/api/hub/categories.js` - Categories
- `functions/api/hub/search.js` - Search

---

## Content Strategy

### Target Audience

1. **Current Toast Users** - Need optimization tips, troubleshooting
2. **Prospective Toast Users** - Comparing POS systems
3. **Restaurant Operators** - General operational advice

### Content Pillars

| Pillar | Description | Example Topics |
|--------|-------------|----------------|
| **Toast Mastery** | Deep dives into Toast features | Menu engineering, KDS optimization, reporting |
| **Troubleshooting** | Common issues and fixes | Printer problems, connection issues, errors |
| **Industry Insights** | Restaurant trends and analysis | Labor trends, cost management, tech adoption |
| **Case Studies** | Client success stories | Before/after with metrics |
| **Quick Tips** | Bite-sized actionable advice | 5-minute improvements |

### SEO Keywords Target

**Primary:**
- "Toast POS tips"
- "Toast POS troubleshooting"
- "Toast menu setup"
- "Restaurant POS consulting"

**Long-tail:**
- "How to set up modifiers in Toast"
- "Toast KDS station configuration"
- "Toast reporting best practices"
- "Cape Cod restaurant consultant"

---

## Phase 1: Content Foundation (Week 1)

### 1.1 Create Initial Content Categories

**API:** POST `/api/hub/categories`

```javascript
const categories = [
  { slug: 'toast-tips', name: 'Toast Tips & Tricks', description: 'Optimize your Toast POS setup' },
  { slug: 'troubleshooting', name: 'Troubleshooting', description: 'Fix common Toast issues' },
  { slug: 'menu-engineering', name: 'Menu Engineering', description: 'Design menus that sell' },
  { slug: 'operations', name: 'Operations', description: 'Run your restaurant efficiently' },
  { slug: 'case-studies', name: 'Case Studies', description: 'Real client success stories' },
  { slug: 'industry-news', name: 'Industry News', description: 'Restaurant industry updates' }
];
```

### 1.2 Seed Initial Articles (5 foundational)

| Title | Category | Type |
|-------|----------|------|
| "Complete Guide to Toast Menu Setup" | toast-tips | Pillar content (~2000 words) |
| "10 Toast Features You're Not Using" | toast-tips | List article (~1500 words) |
| "Troubleshooting Toast Printer Issues" | troubleshooting | How-to (~1000 words) |
| "Menu Engineering: Psychology of Pricing" | menu-engineering | Educational (~1500 words) |
| "Why We Started R&G Consulting" | case-studies | Story (~800 words) |

### 1.3 Expand FAQ Section

Current: 4 questions
Target: 25+ questions covering:
- Toast basics (10)
- Pricing/services (5)
- Implementation process (5)
- Support plans (5)

---

## Phase 2: AI-Assisted Content Pipeline (Week 2)

### 2.1 Content Generation Workflow

```
1. Topic Selection
   ├── Manual: Admin picks topic
   └── AI: Suggest based on search trends, support tickets

2. Outline Generation
   └── Claude API creates outline with H2/H3 structure

3. Draft Creation
   └── Claude API writes first draft with:
       - SEO-optimized headings
       - Internal links to related content
       - Call-to-action sections

4. Human Review
   └── Admin edits, adds images, approves

5. Publication
   └── Schedule or immediate publish
```

### 2.2 Content Generation API

**File:** `functions/api/admin/hub/generate-article.js`

```javascript
export async function onRequestPost(context) {
  const auth = await verifyAuth(context.request, context.env);
  if (!auth.authenticated) return unauthorizedResponse();

  const { topic, category, keywords, style } = await context.request.json();

  // Generate with Claude
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': context.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2024-01-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: `You are a content writer for R&G Consulting, a restaurant consulting firm specializing in Toast POS. Write SEO-optimized content that's helpful, actionable, and positions R&G as experts.`,
      messages: [{
        role: 'user',
        content: `Write a comprehensive article about: ${topic}

Category: ${category}
Target keywords: ${keywords.join(', ')}
Style: ${style || 'professional, helpful, actionable'}

Include:
- Engaging introduction
- Clear H2 and H3 headings
- Practical examples
- Pro tips from a consultant's perspective
- Clear call-to-action at the end

Format as markdown.`
      }]
    })
  });

  const data = await response.json();
  const content = data.content[0].text;

  // Save as draft
  const articleId = crypto.randomUUID();
  await context.env.DB.prepare(`
    INSERT INTO articles (id, title, slug, content, category_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'draft', ?)
  `).bind(
    articleId,
    topic,
    slugify(topic),
    content,
    category,
    Math.floor(Date.now() / 1000)
  ).run();

  return Response.json({ success: true, data: { id: articleId, content } });
}
```

---

## Phase 3: Newsletter Integration (Week 3)

### 3.1 Newsletter Subscription

Add subscription form to Toast Hub:

```typescript
// ToastHub.tsx
<section className="bg-blue-50 p-8 rounded-lg">
  <h2>Get Toast Tips in Your Inbox</h2>
  <p>Weekly tips to optimize your restaurant operations.</p>
  <form onSubmit={handleSubscribe}>
    <input type="email" placeholder="your@email.com" />
    <button type="submit">Subscribe</button>
  </form>
</section>
```

### 3.2 Connect to Email Sequences

New sequence: `seq_newsletter_001`
- Welcome email with top 3 articles
- Weekly digest of new content
- Monthly recap with metrics

---

## Phase 4: Admin Content Management (Week 4)

### 4.1 Article Editor Component

**File:** `src/components/admin/hub/ArticleEditor.tsx`

```typescript
export function ArticleEditor({ article, onSave }) {
  const [content, setContent] = useState(article?.content || '');
  const [metadata, setMetadata] = useState({
    title: article?.title || '',
    slug: article?.slug || '',
    excerpt: article?.excerpt || '',
    category: article?.category_id || '',
    tags: article?.tags || [],
    seo_title: article?.seo_title || '',
    seo_description: article?.seo_description || '',
    featured_image: article?.featured_image || ''
  });

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Main editor (2 cols) */}
      <div className="col-span-2">
        <input
          value={metadata.title}
          onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
          placeholder="Article title"
          className="text-2xl font-bold w-full p-2 border-b"
        />
        <MarkdownEditor
          value={content}
          onChange={setContent}
          height={500}
        />
      </div>

      {/* Sidebar (1 col) */}
      <div className="space-y-4">
        <div>
          <label>Status</label>
          <select>
            <option value="draft">Draft</option>
            <option value="review">In Review</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div>
          <label>Category</label>
          <CategorySelect />
        </div>

        <div>
          <label>Tags</label>
          <TagInput />
        </div>

        <div>
          <label>SEO Title</label>
          <input maxLength={60} />
          <span className="text-xs">{metadata.seo_title.length}/60</span>
        </div>

        <div>
          <label>Meta Description</label>
          <textarea maxLength={160} />
          <span className="text-xs">{metadata.seo_description.length}/160</span>
        </div>

        <button onClick={handleGenerateSEO}>
          Auto-Generate SEO
        </button>

        <button onClick={handleSave} className="w-full bg-blue-600 text-white py-2 rounded">
          Save Article
        </button>
      </div>
    </div>
  );
}
```

### 4.2 Content Calendar View

```typescript
export function ContentCalendar() {
  // Show scheduled articles on calendar
  // Drag-and-drop to reschedule
  // Color by status (draft/review/published)
}
```

---

## Phase 5: Analytics & Metrics (Week 5)

### 5.1 Article Performance Tracking

**Database:**
```sql
CREATE TABLE article_analytics (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  avg_time_on_page INTEGER DEFAULT 0,
  scroll_depth REAL DEFAULT 0,
  cta_clicks INTEGER DEFAULT 0,
  UNIQUE(article_id, date)
);
```

### 5.2 Dashboard Metrics

| Metric | Source |
|--------|--------|
| Total page views | article_views table |
| Popular articles | Top 10 by views |
| Newsletter signups | email_subscribers |
| Lead conversions | UTM tracking |
| Search rankings | Google Search Console API |

---

## MVP 30-Day Content Calendar

| Week | Articles | Topics |
|------|----------|--------|
| 1 | 5 | Foundation content (see Phase 1) |
| 2 | 3 | Troubleshooting guides |
| 3 | 3 | Feature deep-dives |
| 4 | 4 | Quick tips + case study |

**Total MVP: 15 articles**

---

## Content Templates

### Article Template

```markdown
# {Title}

**Reading time:** X minutes
**Last updated:** {date}

{Introduction paragraph - hook the reader}

## What You'll Learn

- Point 1
- Point 2
- Point 3

## {Main Section 1}

{Content}

### {Subsection}

{Content}

> **Pro Tip:** {Insider advice from a consultant's perspective}

## {Main Section 2}

{Content}

## Common Mistakes to Avoid

1. Mistake 1
2. Mistake 2

## Next Steps

{Call to action - schedule consultation, download guide, etc.}

---

**Need help with {topic}?** [Schedule a free consultation](/contact) with our Toast experts.
```

---

## Verification Checklist

### Phase 1 ✅ COMPLETE
- [x] 8 categories created (5 existing + 3 new via migration 0089)
- [x] 5 foundational articles published
- [x] 30 FAQs added (4 existing + 26 new)
- [x] Toast Hub renders content

### Phase 2 ✅ COMPLETE
- [x] AI generation endpoint works (`/api/admin/toast-hub/generate-article`)
- [x] Generated articles save as drafts (auto-saves to D1)
- [x] Admin can edit and publish (via existing admin UI)

### Phase 3 ✅ COMPLETE
- [x] Newsletter signup form works (added to ToastHub.tsx)
- [x] Subscribers added to email list (`email_subscribers` table)
- [x] Welcome email sends (via Resend API)

### Phase 4 - PRE-EXISTING
- [x] Article editor functional (already existed in admin)
- [x] SEO fields editable (already existed)
- [x] Content calendar view works (admin UI)

### Phase 5 - PRE-EXISTING
- [x] View tracking implemented (toast_hub_post_views table)
- [x] Analytics dashboard shows metrics (admin Toast Hub section)
- [x] Popular articles display (via views count)

---

## SEO Implementation

### On-Page SEO

- [ ] Semantic HTML (article, section, h1-h6)
- [ ] Meta title and description per article
- [ ] Canonical URLs
- [ ] Open Graph tags
- [ ] Schema.org Article markup

### Technical SEO

- [ ] XML sitemap includes articles
- [ ] robots.txt allows crawling
- [ ] Page speed optimized
- [ ] Mobile responsive

---

## Implementation Summary

**Completed:** January 26, 2026

### Files Created

| File | Purpose |
|------|---------|
| `migrations/0089_toast_hub_content_seed.sql` | Seeds 3 categories, 5 articles, 26 FAQs |
| `functions/api/admin/toast-hub/generate-article.js` | AI content generation endpoint |
| `functions/api/toast-hub/subscribe.js` | Public newsletter subscription |

### Files Modified

| File | Change |
|------|--------|
| `pages/ToastHub.tsx` | Added newsletter form with email/name inputs |

### D1 Content Summary

| Entity | Count |
|--------|-------|
| Categories | 8 |
| Articles | 5 |
| FAQs | 30 |

### API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/toast-hub/subscribe` | Public | Newsletter subscription |
| `POST /api/admin/toast-hub/generate-article` | Admin | AI article generation |
| `GET /api/admin/toast-hub/generate-article` | Admin | List AI-generated drafts |

### Deployment

- **Migration:** `npx wrangler d1 execute rg-consulting-forms --remote --file=migrations/0089_toast_hub_content_seed.sql`
- **Deploy:** https://b920fba4.restaurant-consulting-site.pages.dev

---

*Author: Claude Opus 4.5*
*For: R&G Consulting Platform*
*Completed: January 26, 2026*
