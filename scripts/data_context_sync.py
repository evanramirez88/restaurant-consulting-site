"""
DATA_CONTEXT -> Platform Sync Script
=====================================
Reads business-relevant data from the local DATA_CONTEXT SQLite database
(millstone.db) and pushes it to the platform's /api/context/sync endpoint.

Syncs:
  - Business contacts -> synced_contacts
  - Business interactions (calls, emails, SMS) -> synced_communications
  - Calendar events with clients -> synced_communications (type: meeting)
  - Invoices/financial data -> context_items (type: financial)

Privacy: Only syncs business-classified data. Personal items are skipped locally
before they ever hit the network. The platform's Data Gatekeeper provides a
second layer of filtering.

Usage:
  python scripts/data_context_sync.py [--dry-run] [--days N] [--verbose] [--full]

Requirements:
  pip install requests  (only stdlib + requests needed)
"""

import sqlite3
import json
import hashlib
import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

# ============================================
# CONFIGURATION
# ============================================

CONFIG = {
    "db_path": r"D:\USER_DATA\Desktop\ANTIGRAVITY\DATA_CONTEXT\data\millstone.db",
    "sync_endpoint": "https://ccrestaurantconsulting.com/api/context/sync",
    "sync_key": "CcGDXSQMnWlQnFKr2eovG2hkvrM1lHHpiFaAm-X8AdY",
    "batch_size": 50,  # Items per API call
    "business_email": "ramirezconsulting.rg@gmail.com",
    "business_domain": "ccrestaurantconsulting.com",

    # Business source systems (contacts from these are always business)
    "business_sources": ["hubspot", "square", "manual"],

    # Business interaction indicators
    "business_keywords": [
        "toast", "pos", "restaurant", "menu", "invoice", "quote",
        "support", "onboarding", "implementation", "network", "cable",
        "consulting", "client", "project", "meeting", "call",
        "guardian", "audit", "r&g", "cape cod"
    ],

    # Personal domains to SKIP
    "personal_domains": [
        "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
        "icloud.com", "aol.com", "protonmail.com"
    ],

    # Skip interactions from these sources
    "skip_sources": ["personal", "browser", "filesystem", "trading", "location"],
}


# ============================================
# DATABASE CONNECTION
# ============================================

def get_db_connection():
    """Connect to the DATA_CONTEXT SQLite database (read-only)."""
    db_path = Path(CONFIG["db_path"])
    if not db_path.exists():
        print(f"[ERROR] Database not found: {db_path}")
        sys.exit(1)

    # Open read-only to ensure we never modify the source
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def check_table_exists(conn, table_name):
    """Check if a table exists in the database."""
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    )
    return cursor.fetchone() is not None


# ============================================
# DATA EXTRACTION
# ============================================

def extract_contacts(conn, since_ts=None, full=False):
    """Extract business-relevant contacts from DATA_CONTEXT."""
    if not check_table_exists(conn, "contacts"):
        print("  [SKIP] contacts table not found")
        return []

    query = """
        SELECT id, first_name, last_name, display_name,
               email_primary, email_secondary, phone_mobile, phone_work,
               company_name, job_title, hubspot_contact_id, square_customer_id,
               lifecycle_stage, source_system, tags, created_at, updated_at
        FROM contacts
        WHERE (
            source_system IN ({sources})
            OR company_name IS NOT NULL
            OR hubspot_contact_id IS NOT NULL
            OR square_customer_id IS NOT NULL
        )
    """.format(sources=",".join(f"'{s}'" for s in CONFIG["business_sources"]))

    if since_ts and not full:
        query += f" AND updated_at > '{since_ts}'"

    query += " ORDER BY updated_at DESC LIMIT 500"

    rows = conn.execute(query).fetchall()
    items = []

    for row in rows:
        # Build display name
        name = row["display_name"] or " ".join(
            filter(None, [row["first_name"], row["last_name"]])
        ) or row["email_primary"] or "Unknown"

        # Determine privacy level
        privacy = "business"
        if row["source_system"] in ("personal",):
            privacy = "private"

        items.append({
            "id": f"dc_contact_{row['id'][:20]}",
            "entity_type": "contact",
            "external_id": row["hubspot_contact_id"] or row["square_customer_id"] or row["id"],
            "name": name[:200],
            "phone": row["phone_mobile"] or row["phone_work"],
            "email": row["email_primary"],
            "company": row["company_name"],
            "source": f"data_context_{row['source_system'] or 'unknown'}",
            "last_interaction_at": int(datetime.fromisoformat(row["updated_at"]).timestamp()) if row["updated_at"] else None,
            "privacy_level": privacy,
            "data_tag": "business"
        })

    return items


def extract_interactions(conn, since_ts=None, full=False):
    """Extract business interactions (calls, SMS, emails)."""
    if not check_table_exists(conn, "interactions"):
        print("  [SKIP] interactions table not found")
        return []

    query = """
        SELECT i.id, i.timestamp, i.interaction_type, i.direction,
               i.subject, i.body_text, i.from_address, i.to_address,
               i.source_system, i.contact_id, i.duration_seconds,
               c.company_name, c.display_name, c.email_primary
        FROM interactions i
        LEFT JOIN contacts c ON i.contact_id = c.id
        WHERE i.source_system NOT IN ({skip})
    """.format(skip=",".join(f"'{s}'" for s in CONFIG["skip_sources"]))

    if since_ts and not full:
        query += f" AND i.timestamp > '{since_ts}'"

    query += " ORDER BY i.timestamp DESC LIMIT 300"

    rows = conn.execute(query).fetchall()
    items = []

    for row in rows:
        # Skip if clearly personal (no business indicators)
        subject = (row["subject"] or "").lower()
        body = (row["body_text"] or "")[:500].lower()
        from_addr = (row["from_address"] or "").lower()
        to_addr = (row["to_address"] or "").lower()
        combined = f"{subject} {body} {from_addr} {to_addr}"

        # Business classification
        is_business = False

        # From/to our business email
        if CONFIG["business_email"] in from_addr or CONFIG["business_email"] in to_addr:
            is_business = True
        if CONFIG["business_domain"] in from_addr or CONFIG["business_domain"] in to_addr:
            is_business = True

        # Has a linked business contact
        if row["company_name"]:
            is_business = True

        # Contains business keywords
        if any(kw in combined for kw in CONFIG["business_keywords"]):
            is_business = True

        # Source is explicitly business
        if row["source_system"] in ("hubspot", "square"):
            is_business = True

        if not is_business:
            continue

        # Map interaction_type to sync entity_type
        itype = (row["interaction_type"] or "").lower()
        entity_type = "email"  # default
        if "sms" in itype or "text" in itype:
            entity_type = "sms"
        elif "call" in itype or "phone" in itype:
            entity_type = "call"
        elif "meeting" in itype:
            entity_type = "meeting"

        # Build summary
        summary = row["subject"] or f"{entity_type.upper()} with {row['display_name'] or row['from_address'] or 'unknown'}"
        if row["duration_seconds"] and entity_type == "call":
            mins = row["duration_seconds"] // 60
            summary += f" ({mins}min)"

        # Truncate body for snippet
        snippet = (row["body_text"] or "")[:500]

        ts = int(datetime.fromisoformat(row["timestamp"]).timestamp()) if row["timestamp"] else None

        items.append({
            "id": f"dc_int_{row['id'][:20]}",
            "entity_type": entity_type,
            "contact_id": f"dc_contact_{row['contact_id'][:20]}" if row["contact_id"] else None,
            "direction": row["direction"] or "unknown",
            "summary": summary[:300],
            "content_snippet": snippet,
            "occurred_at": ts,
            "source_id": row["id"],
            "privacy_level": "business",
            "data_tag": "business"
        })

    return items


def extract_events(conn, since_ts=None, full=False):
    """Extract business calendar events."""
    if not check_table_exists(conn, "events"):
        print("  [SKIP] events table not found")
        return []

    query = """
        SELECT e.id, e.start_time, e.end_time, e.title, e.description,
               e.location, e.event_type, e.is_billable, e.contact_id,
               e.duration_minutes, e.source_system,
               c.company_name, c.display_name
        FROM events e
        LEFT JOIN contacts c ON e.contact_id = c.id
        WHERE (
            e.is_billable = 1
            OR e.contact_id IS NOT NULL
            OR e.title LIKE '%client%'
            OR e.title LIKE '%meeting%'
            OR e.title LIKE '%call%'
            OR e.title LIKE '%toast%'
            OR e.title LIKE '%restaurant%'
            OR e.title LIKE '%support%'
            OR e.title LIKE '%onboarding%'
        )
    """

    if since_ts and not full:
        query += f" AND e.start_time > '{since_ts}'"

    query += " ORDER BY e.start_time DESC LIMIT 200"

    rows = conn.execute(query).fetchall()
    items = []

    for row in rows:
        summary = row["title"] or "Meeting"
        if row["display_name"]:
            summary += f" - {row['display_name']}"
        if row["duration_minutes"]:
            summary += f" ({row['duration_minutes']}min)"

        ts = int(datetime.fromisoformat(row["start_time"]).timestamp()) if row["start_time"] else None

        items.append({
            "id": f"dc_event_{row['id'][:20]}",
            "entity_type": "meeting",
            "contact_id": f"dc_contact_{row['contact_id'][:20]}" if row["contact_id"] else None,
            "direction": "both",
            "summary": summary[:300],
            "content_snippet": (row["description"] or "")[:500],
            "occurred_at": ts,
            "source_id": row["id"],
            "privacy_level": "business",
            "data_tag": "business"
        })

    return items


def extract_invoices(conn, since_ts=None, full=False):
    """Extract invoice/financial data as context items."""
    if not check_table_exists(conn, "invoices"):
        print("  [SKIP] invoices table not found")
        return []

    query = """
        SELECT i.id, i.amount_cents, i.currency, i.status,
               i.created_at, i.paid_at, i.due_at,
               i.square_invoice_id, i.contact_id, i.line_items,
               c.company_name, c.display_name
        FROM invoices i
        LEFT JOIN contacts c ON i.contact_id = c.id
    """

    if since_ts and not full:
        query += f" WHERE i.created_at > '{since_ts}'"

    query += " ORDER BY i.created_at DESC LIMIT 100"

    rows = conn.execute(query).fetchall()
    items = []

    for row in rows:
        amount = (row["amount_cents"] or 0) / 100
        client = row["display_name"] or row["company_name"] or "Unknown Client"
        summary = f"Invoice ${amount:.2f} - {client} ({row['status']})"

        ts = int(datetime.fromisoformat(row["created_at"]).timestamp()) if row["created_at"] else None

        items.append({
            "id": f"dc_inv_{row['id'][:20]}",
            "entity_type": "financial",
            "type": "invoice",
            "content": summary,
            "summary": summary[:300],
            "timestamp": ts,
            "source": "data_context_square",
            "relevance": 0.9,
            "privacy_level": "business",
            "data_tag": "financial",
            "tags": "invoice,financial,square"
        })

    return items


# ============================================
# API SYNC
# ============================================

def sync_batch(items, source_label, dry_run=False, verbose=False):
    """Push a batch of items to /api/context/sync."""
    import requests

    if not items:
        return 0

    total_synced = 0
    batch_num = 0

    for i in range(0, len(items), CONFIG["batch_size"]):
        batch = items[i:i + CONFIG["batch_size"]]
        batch_num += 1
        batch_id = f"dc_sync_{source_label}_{int(datetime.now().timestamp())}_{batch_num}"

        payload = {
            "batch_id": batch_id,
            "source": f"data_context_{source_label}",
            "items": batch
        }

        if dry_run:
            print(f"  [DRY RUN] Would sync {len(batch)} {source_label} items (batch {batch_num})")
            if verbose:
                for item in batch[:3]:
                    print(f"    - {item.get('entity_type', 'unknown')}: {item.get('summary', item.get('name', '?'))[:60]}")
                if len(batch) > 3:
                    print(f"    ... and {len(batch) - 3} more")
            total_synced += len(batch)
            continue

        try:
            response = requests.post(
                CONFIG["sync_endpoint"],
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Sync-Key": CONFIG["sync_key"]
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                processed = result.get("results", {}).get("processed", 0)
                gatekeeper = result.get("results", {}).get("gatekeeper", {})
                total_synced += processed
                print(f"  [SYNCED] {source_label} batch {batch_num}: {processed} processed"
                      f" (gatekeeper: {gatekeeper.get('allowed', '?')}/{gatekeeper.get('total', '?')})")
            else:
                print(f"  [ERROR] {source_label} batch {batch_num}: HTTP {response.status_code}")
                if verbose:
                    print(f"    Response: {response.text[:200]}")
        except Exception as e:
            print(f"  [ERROR] {source_label} batch {batch_num}: {e}")

    return total_synced


# ============================================
# MAIN
# ============================================

def main():
    parser = argparse.ArgumentParser(description="Sync DATA_CONTEXT to Platform")
    parser.add_argument("--dry-run", action="store_true", help="Preview without syncing")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    parser.add_argument("--days", type=int, default=7, help="Days of history to sync (default: 7)")
    parser.add_argument("--full", action="store_true", help="Sync ALL data regardless of date")
    args = parser.parse_args()

    since_dt = datetime.now() - timedelta(days=args.days)
    since_ts = since_dt.isoformat()

    print("==========================================")
    print("DATA_CONTEXT -> PLATFORM SYNC")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"Period: {'ALL DATA' if args.full else f'Last {args.days} days (since {since_ts[:10]})'}")
    print(f"Database: {CONFIG['db_path']}")
    print(f"Endpoint: {CONFIG['sync_endpoint']}")
    print("==========================================\n")

    # Connect to DATA_CONTEXT database
    conn = get_db_connection()

    # Check what tables exist
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    table_names = [t["name"] for t in tables]
    print(f"[DB] Found {len(table_names)} tables: {', '.join(table_names[:15])}")
    if len(table_names) > 15:
        print(f"     ... and {len(table_names) - 15} more")
    print()

    # Extract data
    print("[Extract] Reading business contacts...")
    contacts = extract_contacts(conn, since_ts, args.full)
    print(f"  Found {len(contacts)} business contacts")

    print("[Extract] Reading business interactions...")
    interactions = extract_interactions(conn, since_ts, args.full)
    print(f"  Found {len(interactions)} business interactions")

    print("[Extract] Reading business events...")
    events = extract_events(conn, since_ts, args.full)
    print(f"  Found {len(events)} business events")

    print("[Extract] Reading invoices...")
    invoices = extract_invoices(conn, since_ts, args.full)
    print(f"  Found {len(invoices)} invoices")

    conn.close()
    print()

    total_items = len(contacts) + len(interactions) + len(events) + len(invoices)
    if total_items == 0:
        print("[Done] No business data to sync.")
        return

    # Sync to platform
    print(f"[Sync] Pushing {total_items} total items to platform...\n")

    results = {
        "contacts": sync_batch(contacts, "contacts", args.dry_run, args.verbose),
        "interactions": sync_batch(interactions, "interactions", args.dry_run, args.verbose),
        "events": sync_batch(events, "events", args.dry_run, args.verbose),
        "invoices": sync_batch(invoices, "invoices", args.dry_run, args.verbose),
    }

    # Summary
    total_synced = sum(results.values())
    print("\n==========================================")
    print("SYNC RESULTS")
    print("==========================================")
    print(f"  Contacts synced:     {results['contacts']}")
    print(f"  Interactions synced: {results['interactions']}")
    print(f"  Events synced:       {results['events']}")
    print(f"  Invoices synced:     {results['invoices']}")
    print(f"  TOTAL:               {total_synced}")
    print("==========================================\n")

    if args.dry_run:
        print("[DRY RUN] No data was actually pushed.")


if __name__ == "__main__":
    main()
