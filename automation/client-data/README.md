# Client Data Import System

This folder contains the import system for client data in the restaurant-consulting-site platform.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run once (process pending files)
python import_service.py --base-path "."

# Watch mode (continuous monitoring)
python import_service.py --base-path "." --watch
```

## Folder Structure

```
client-data/
├── import/
│   ├── pending/       # Drop new files here for processing
│   ├── processed/     # Successfully imported files
│   └── failed/        # Files that couldn't be matched
├── clients/           # Organized client folders
│   ├── _clients.json  # Known clients for matching
│   └── {client-slug}/ # Per-client folders
└── import_service.py  # The import processor
```

## How to Import Data

1. **Drop files** into `import/pending/`
2. **Run the service**: `python import_service.py --base-path "."`
3. Files are automatically:
   - Parsed (txt, md, csv, json, xml, xlsx, pdf)
   - Matched to a client by filename or content
   - Moved to the appropriate subfolder (intel, documents, communications, etc.)
   - Logged with a `.import_log.json` file

## File Naming Convention

For automatic client matching, use this naming:
```
{client-slug}_{document-type}_{date}.{ext}

Examples:
crown-anchor_intel_2025-12-11.pdf
crown-anchor_strategy_2026-01.txt
```

## Client Folder Structure

Each client folder:
```
{client-slug}/
├── intel/           # Research, competitive intelligence
├── documents/       # Contracts, receipts, legal
├── menus/           # Menu files and exports
├── quotes/          # Quote history
├── communications/  # Emails, SMS exports
└── portal_data/     # Data synced to client portal
```

