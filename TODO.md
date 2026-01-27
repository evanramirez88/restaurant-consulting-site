# Restaurant-Consulting-Site TODO List

## Priority: Critical 🔴 IMMEDIATE

### D1 Migration (Apply Now)
- [x] **Apply D1 migration**: 0020_client_intelligence.sql already applied (tables exist)
- [x] **Verify migration**: client_profiles table exists with proper columns

### Local Infrastructure (SAGE-LENOVO)
- [x] **Seagate drive letter confirmed**: `D:\`
- [x] **Verify Docker Desktop** is installed on SAGE-LENOVO (v29.1.3, 6 containers running)
- [x] **Create storage folders**: `D:\rg_data\{clients,postgres,redis,minio,backups,sync}` all created
- [x] **Docker services running**: millstone_postgres, n8n, qdrant, neo4j already operational
- [ ] **Configure .env file** for local control center (manual step for Evan)

---

## Priority: High 🔴

### Client Intelligence System (New Feature)
- [x] **Google AI Studio prototype extracted**: `cape-cod-culinary-compass-pro-extracted\`
- [ ] **Integrate prototype components**:
  - [ ] FactReviewCard - Tinder-style fact approval
  - [ ] IngestionModal - Text/file ingestion
  - [ ] DashboardCharts - Visualization
- [ ] **Make AI model-agnostic**: Support Gemini, Claude, OpenAI
- [ ] **Add API key configuration** in admin settings

### Import System
- [x] **Import service exists**: `automation/client-data/import_service.py`
- [ ] **Add folder watcher** for `import/pending/`
- [ ] **Add docx support** (python-docx)
- [ ] **Connect to intelligence API** for automatic enrichment
- [ ] **Test import flow** with sample files

### Client Management
- [ ] **Create client list page** with portal toggle
- [ ] **Create client profile page** with intel section
- [ ] **API endpoint**: `/api/admin/clients/:id/portal-toggle`
- [ ] **Send welcome email** when portal enabled

---

## Priority: Medium 🟡

### Dual Storage Architecture
- [ ] Build D1 ↔ PostgreSQL sync service
- [ ] Portal-visible fields sync to D1
- [ ] All data mirrors to local PostgreSQL
- [ ] Conflict resolution strategy
- [ ] Sync status dashboard in admin

### Form Connectivity Audit
- [ ] Verify Contact form → HubSpot + D1
- [ ] Verify Quote request → notifications
- [ ] Verify Portal submissions → client_submitted field
- [ ] Test all form endpoints

### Research & Enrichment Engine
- [ ] Port market sync from prototype
- [ ] AI-powered fact extraction
- [ ] Source tracking with confidence scores
- [ ] Research dashboard in admin

---

## Priority: Low 🟢

### Future Improvements
- [ ] OCR support for scanned PDFs (pytesseract)
- [ ] SMS export parser improvements
- [ ] Email export parser (EML/MBOX)
- [ ] Automated intel refresh scheduling
- [ ] Integration with HubSpot for contact enrichment
- [ ] Report generation from client intel

---

## Completed ✅

### January 27, 2026 Session
- [x] **Media Suite migration applied** - file_uploads extended with media processing columns
- [x] **Media Suite tables created** - media_jobs, media_library, media_workflows, workflow_executions, media_analytics
- [x] **Deduplication system deployed** - entity_resolution_rules, duplicate_candidates, merged_entities, canonical_contacts
- [x] **Intelligence aggregation docs** - DATA_AGGREGATION_FLOW.md with full data flow documentation
- [x] **Health check endpoint** - /api/admin/intelligence/health for pipeline monitoring
- [x] **Sync endpoint** - /api/admin/intelligence/sync-aggregated for context sync
- [x] **Local infrastructure verified** - Docker running with 6 containers, storage folders created
- [x] **DATA_CONTEXT harvesters audited** - All harvesters exist and ready for activation
- [x] **Git commits and deployment** - All changes pushed and deployed to Cloudflare Pages

### January 12, 2026 Session
- [x] Comprehensive project review completed
- [x] Extracted Google AI Studio prototype ZIP
- [x] Analyzed local control center Docker setup
- [x] Confirmed Seagate drive letter as D:\
- [x] Created implementation plan and task list
- [x] Updated all documentation

### January 10, 2026 Session
- [x] Platform architecture analysis
- [x] Dual-storage architecture design (D1 + Seagate)
- [x] Import folder structure created
- [x] Crown & Anchor test client folders created
- [x] D1 migration created (0020_client_intelligence.sql)
- [x] ClientForm.tsx updated with intel fields
- [x] Import service created with file parsers
- [x] Import service tested (2 files imported successfully)
- [x] Local control center Docker infrastructure created
- [x] All documentation updated

---

## Notes

### Platform Architecture
- **Cloud Storage**: Cloudflare D1 (portal-visible data)
- **Local Storage**: Seagate D:\ via Docker (PostgreSQL, MinIO, Redis)
- **Sync Strategy**: Bidirectional, cloud wins for portal data

### Key File Paths
| Resource | Path |
|----------|------|
| Project Root | `c:\Users\evanr\Desktop\BUSINESS_WEBSITE\restaurant-consulting-site` |
| Seagate Data | `D:\rg_data\` |
| Prototype | `cape-cod-culinary-compass-pro-extracted\` |
| Import Pending | `automation\client-data\import\pending\` |
| Client Folders | `automation\client-data\clients\` |

### API Keys Required
- **AI Provider** (choose one): Gemini, Claude, or OpenAI API key
- **Already Configured**: Resend, HubSpot, Square

### Network Access (SAGE-LENOVO)
- Tailscale IP: 100.72.223.35
- Hostname: sage-lenovo.tail0fa33b.ts.net
- Ports: 5432 (PostgreSQL), 6379 (Redis), 8000 (API), 9000 (MinIO)
