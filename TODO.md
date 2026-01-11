# Restaurant-Consulting-Site TODO List

## Priority: High 🔴

### Next Session (On SAGE-LENOVO)
- [ ] **Determine Seagate drive letter** on SAGE-LENOVO
- [ ] **Apply D1 migration**: `wrangler d1 execute ccrc-db --file=migrations/0020_client_intelligence.sql`
- [ ] **Verify Docker is installed** on SAGE-LENOVO
- [ ] **Run local control center setup**: `.\setup.ps1 -SeagateDriveLetter "X"` (replace X with actual letter)
- [ ] **Start Docker services**: `.\start-services.ps1`
- [ ] **Copy remaining Crown & Anchor files** to import system

### Research & Intelligence Engine (New Feature)
- [ ] **Download Google AI Studio prototype** (user has existing prototype)
- [ ] **Review prototype architecture** and determine if rebuild or integrate
- [ ] **Build client research/enrichment pipeline** that:
  - Aggregates intel from multiple sources
  - Auto-enriches client profiles
  - Populates `intel_profile` field
  - Stays local (NOT synced to client portal)
- [ ] **Integrate with import service** for automatic intel extraction
- [ ] **Create admin UI** for viewing/editing intel on client profiles

---

## Priority: Medium 🟡

### Import Service Enhancements
- [ ] Add more file format support (docx, eml)
- [ ] OCR support for scanned PDFs (pytesseract)
- [ ] Better content-based client matching (NLP)
- [ ] Admin UI for reviewing failed imports
- [ ] Bulk import tool for existing data

### D1 ↔ PostgreSQL Sync
- [ ] Build sync service for bidirectional data flow
- [ ] Portal-visible fields sync to D1
- [ ] All data mirrors to local PostgreSQL
- [ ] Conflict resolution strategy
- [ ] Sync status dashboard in admin

### Client Portal Enhancements
- [ ] Capture all client-submitted data to `client_submitted` field
- [ ] Audit trail for portal activity
- [ ] File upload from portal → local storage
- [ ] Custom fields per client

---

## Priority: Low 🟢

### Future Improvements
- [ ] SMS export parser improvements (XML → contact extraction)
- [ ] Email export parser (EML/MBOX)
- [ ] Automated intel refresh scheduling
- [ ] Client activity scoring
- [ ] Integration with HubSpot for contact enrichment
- [ ] Report generation from client intel

---

## Completed ✅

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

### Seagate Drive
- Location: SAGE-LENOVO (Lenovo PC that's always running)
- Size: 20TB
- Purpose: Primary data vault for all client data
- Drive letter: **TBD (determine in next session)**

### Research & Intelligence Engine
- User has a **Google AI Studio prototype** that can be downloaded
- Can be used as reference or rebuilt entirely
- Goal: Automatic client profile enrichment
- Intel data stays LOCAL only, never synced to client portal

### SAGE-LENOVO Network
- Tailscale IP: 100.72.223.35
- Hostname: sage-lenovo.tail0fa33b.ts.net
- Runs other programs (Sagenode/ADA) but restaurant-consulting-site is **completely independent**
