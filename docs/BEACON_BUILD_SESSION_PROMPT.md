# Beacon Platform Build Session Prompt

Copy and paste everything below the line into a new Claude Code CLI session:

---

## SESSION PROMPT

I need you to build out the Beacon content aggregation and curation platform for my restaurant consulting website. This is a multi-phase build.

**Project Location:** `C:\Users\evanr\projects\restaurant-consulting-site`

**Read these files first:**
1. `docs/BEACON_CONTENT_PLATFORM_ARCHITECTURE.md` - Full architecture and requirements
2. `migrations/0032_beacon_content_platform.sql` - Database schema (run this migration first)
3. `C:\Users\evanr\.claude\CLAUDE.md` - Project context and credentials

**What Beacon Does:**
- Aggregates content from Reddit (r/ToastPOS), Toast documentation, and my own expertise
- Provides admin curation interface to approve/reject/transform content
- Publishes curated content to public-facing SEO-optimized feed
- Uses AI to summarize, categorize, and suggest actions on incoming content

**Build Order:**

**Phase 1 - Foundation:**
1. Run the database migration: `npx wrangler d1 execute rg-consulting-forms --remote --file=migrations/0032_beacon_content_platform.sql`
2. Create the Reddit fetcher worker at `workers/beacon-fetcher/`
3. Create basic admin API endpoints at `functions/api/admin/beacon/`
4. Create basic admin UI component at `src/components/admin/beacon/BeaconDashboard.tsx`
5. Integrate into the Platform Tools section (replace old Toast Hub)

**Phase 2 - AI Enhancement:**
1. Add AI processing using Cloudflare Workers AI for incoming items
2. Integrate NotebookLM MCP for querying owner's notebooks
3. Add smart categorization and priority scoring

**Phase 3 - Workshop:**
1. Content transformation pipeline
2. Template system
3. AI-assisted content generation

**Phase 4 - Public Feed:**
1. Public feed page at `/beacon`
2. Individual post pages at `/beacon/:type/:slug`
3. SEO optimization (structured data, meta tags)
4. RSS/JSON feeds

**Key Technical Details:**
- Use Cloudflare Workers for fetchers (cron scheduled)
- D1 database for all storage
- Reddit API: `https://www.reddit.com/r/ToastPOS/new.json?limit=25` (no auth needed)
- NotebookLM integration via existing MCP skill

**Start with Phase 1.** Create the Reddit fetcher worker first, then the admin endpoints, then the UI.

The working name is "Beacon" but this may change - use this name in code/UI for now.

Let me know when you've read the architecture doc and are ready to start building.
