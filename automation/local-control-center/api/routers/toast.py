"""
Toast Integration Router

Manages Toast POS integrations:
- Client credential management (encrypted)
- Location/restaurant management
- Toast-specific job operations
- Health monitoring for Toast integrations
"""

from fastapi import APIRouter, HTTPException, Query, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import uuid
import json
import logging
import httpx
from cryptography.fernet import Fernet
import base64
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/toast", tags=["Toast Integration"])

# Encryption key for Toast credentials
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)


# ============================================
# MODELS
# ============================================

class ToastIntegrationStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    ERROR = "error"
    EXPIRED = "expired"


class ToastCredentialsCreate(BaseModel):
    client_id: uuid.UUID
    restaurant_id: uuid.UUID
    toast_guid: str
    username: str
    password: str
    totp_secret: Optional[str] = None
    partner_code: Optional[str] = None


class ToastCredentialsUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    totp_secret: Optional[str] = None
    partner_code: Optional[str] = None
    status: Optional[ToastIntegrationStatus] = None


class ToastIntegrationResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    restaurant_id: uuid.UUID
    toast_guid: str
    username: str
    status: ToastIntegrationStatus
    last_login_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    last_error: Optional[str] = None
    menu_count: int = 0
    item_count: int = 0
    modifier_group_count: int = 0
    health_score: int = 0
    created_at: datetime
    updated_at: datetime


class ToastHealthCheck(BaseModel):
    integration_id: uuid.UUID
    restaurant_name: str
    toast_guid: str
    status: str
    login_success: bool
    menu_accessible: bool
    ui_changes_detected: bool
    response_time_ms: int
    selector_health: Dict[str, bool]
    checked_at: datetime


class ToastMenuSummary(BaseModel):
    integration_id: uuid.UUID
    toast_guid: str
    menus: List[Dict[str, Any]]
    total_items: int
    total_modifiers: int
    last_modified: Optional[datetime] = None
    fetched_at: datetime


class ToastJobRequest(BaseModel):
    job_type: str  # menu_sync, item_create, modifier_update, etc.
    integration_id: uuid.UUID
    config: Dict[str, Any] = Field(default_factory=dict)
    priority: int = 1
    scheduled_at: Optional[datetime] = None


class GoldenCopyResult(BaseModel):
    integration_id: uuid.UUID
    page_name: str
    match: bool
    similarity_score: float
    differences: List[Dict[str, Any]]
    screenshot_path: Optional[str] = None
    captured_at: datetime


# ============================================
# DEPENDENCY INJECTION
# ============================================

async def get_db():
    from ..main import db_pool
    async with db_pool.acquire() as conn:
        yield conn


async def get_redis():
    from ..main import redis_client
    return redis_client


# ============================================
# CREDENTIALS MANAGEMENT
# ============================================

@router.post("/integrations", response_model=ToastIntegrationResponse, status_code=201)
async def create_integration(creds: ToastCredentialsCreate, db=Depends(get_db)):
    """Create a new Toast integration with encrypted credentials."""
    # Verify client and restaurant exist
    client = await db.fetchrow("SELECT id FROM clients WHERE id = $1", creds.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    restaurant = await db.fetchrow(
        "SELECT id FROM restaurants WHERE id = $1 AND client_id = $2",
        creds.restaurant_id, creds.client_id
    )
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Check for existing integration
    existing = await db.fetchrow(
        "SELECT id FROM toast_integrations WHERE toast_guid = $1",
        creds.toast_guid
    )
    if existing:
        raise HTTPException(status_code=409, detail="Integration already exists for this Toast GUID")

    # Encrypt credentials
    encrypted_password = fernet.encrypt(creds.password.encode()).decode()
    encrypted_totp = fernet.encrypt(creds.totp_secret.encode()).decode() if creds.totp_secret else None

    integration_id = uuid.uuid4()

    row = await db.fetchrow("""
        INSERT INTO toast_integrations (
            id, client_id, restaurant_id, toast_guid, username,
            encrypted_password, encrypted_totp_secret, partner_code,
            status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())
        RETURNING *
    """, integration_id, creds.client_id, creds.restaurant_id, creds.toast_guid,
         creds.username, encrypted_password, encrypted_totp, creds.partner_code)

    logger.info(f"Created Toast integration {integration_id} for restaurant {creds.restaurant_id}")

    return _row_to_integration_response(row)


@router.get("/integrations", response_model=List[ToastIntegrationResponse])
async def list_integrations(
    client_id: Optional[uuid.UUID] = None,
    status: Optional[ToastIntegrationStatus] = None,
    limit: int = Query(50, ge=1, le=200),
    db=Depends(get_db)
):
    """List Toast integrations."""
    query = """
        SELECT ti.*,
               (SELECT COUNT(*) FROM toast_menus WHERE integration_id = ti.id) as menu_count,
               (SELECT COUNT(*) FROM toast_items WHERE integration_id = ti.id) as item_count,
               (SELECT COUNT(*) FROM toast_modifier_groups WHERE integration_id = ti.id) as modifier_group_count
        FROM toast_integrations ti
        WHERE 1=1
    """
    params = []
    param_idx = 1

    if client_id:
        query += f" AND ti.client_id = ${param_idx}"
        params.append(client_id)
        param_idx += 1

    if status:
        query += f" AND ti.status = ${param_idx}"
        params.append(status.value)
        param_idx += 1

    query += f" ORDER BY ti.created_at DESC LIMIT ${param_idx}"
    params.append(limit)

    rows = await db.fetch(query, *params)
    return [_row_to_integration_response(row) for row in rows]


@router.get("/integrations/{integration_id}", response_model=ToastIntegrationResponse)
async def get_integration(integration_id: uuid.UUID, db=Depends(get_db)):
    """Get a specific Toast integration."""
    row = await db.fetchrow("""
        SELECT ti.*,
               (SELECT COUNT(*) FROM toast_menus WHERE integration_id = ti.id) as menu_count,
               (SELECT COUNT(*) FROM toast_items WHERE integration_id = ti.id) as item_count,
               (SELECT COUNT(*) FROM toast_modifier_groups WHERE integration_id = ti.id) as modifier_group_count
        FROM toast_integrations ti
        WHERE ti.id = $1
    """, integration_id)

    if not row:
        raise HTTPException(status_code=404, detail="Integration not found")

    return _row_to_integration_response(row)


@router.patch("/integrations/{integration_id}", response_model=ToastIntegrationResponse)
async def update_integration(
    integration_id: uuid.UUID,
    update: ToastCredentialsUpdate,
    db=Depends(get_db)
):
    """Update Toast integration credentials or status."""
    existing = await db.fetchrow("SELECT * FROM toast_integrations WHERE id = $1", integration_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Integration not found")

    updates = []
    params = []
    param_idx = 1

    if update.username:
        updates.append(f"username = ${param_idx}")
        params.append(update.username)
        param_idx += 1

    if update.password:
        encrypted_password = fernet.encrypt(update.password.encode()).decode()
        updates.append(f"encrypted_password = ${param_idx}")
        params.append(encrypted_password)
        param_idx += 1

    if update.totp_secret:
        encrypted_totp = fernet.encrypt(update.totp_secret.encode()).decode()
        updates.append(f"encrypted_totp_secret = ${param_idx}")
        params.append(encrypted_totp)
        param_idx += 1

    if update.partner_code is not None:
        updates.append(f"partner_code = ${param_idx}")
        params.append(update.partner_code)
        param_idx += 1

    if update.status:
        updates.append(f"status = ${param_idx}")
        params.append(update.status.value)
        param_idx += 1

    if not updates:
        return _row_to_integration_response(existing)

    params.append(integration_id)
    query = f"""
        UPDATE toast_integrations
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = ${param_idx}
        RETURNING *
    """

    row = await db.fetchrow(query, *params)
    return _row_to_integration_response(row)


@router.delete("/integrations/{integration_id}")
async def delete_integration(integration_id: uuid.UUID, db=Depends(get_db)):
    """Delete a Toast integration."""
    result = await db.fetchrow(
        "DELETE FROM toast_integrations WHERE id = $1 RETURNING id",
        integration_id
    )

    if not result:
        raise HTTPException(status_code=404, detail="Integration not found")

    return {"status": "deleted", "integration_id": str(integration_id)}


# ============================================
# HEALTH CHECK ENDPOINTS
# ============================================

@router.post("/integrations/{integration_id}/health-check", response_model=ToastHealthCheck)
async def run_health_check(
    integration_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db=Depends(get_db)
):
    """Run a health check on a Toast integration."""
    integration = await db.fetchrow("""
        SELECT ti.*, r.name as restaurant_name
        FROM toast_integrations ti
        JOIN restaurants r ON ti.restaurant_id = r.id
        WHERE ti.id = $1
    """, integration_id)

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Decrypt credentials
    password = fernet.decrypt(integration["encrypted_password"].encode()).decode()
    totp_secret = None
    if integration["encrypted_totp_secret"]:
        totp_secret = fernet.decrypt(integration["encrypted_totp_secret"].encode()).decode()

    # Call browser-service health check
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://browser-service:3000/toast/health-check",
                json={
                    "clientId": str(integration_id),
                    "toastGuid": integration["toast_guid"],
                    "credentials": {
                        "username": integration["username"],
                        "password": password,
                        "totpSecret": totp_secret
                    }
                },
                timeout=120.0
            )
            response.raise_for_status()
            result = response.json()

    except httpx.TimeoutException:
        result = {
            "loginSuccess": False,
            "menuAccessible": False,
            "uiChangesDetected": False,
            "responseTimeMs": 120000,
            "selectorHealth": {},
            "error": "Health check timed out"
        }
    except httpx.RequestError as e:
        logger.error(f"Health check failed for {integration_id}: {e}")
        result = {
            "loginSuccess": False,
            "menuAccessible": False,
            "uiChangesDetected": False,
            "responseTimeMs": 0,
            "selectorHealth": {},
            "error": str(e)
        }

    # Store health check result
    await db.execute("""
        INSERT INTO toast_health_checks (
            integration_id, login_success, menu_accessible,
            ui_changes_detected, response_time_ms, selector_health,
            error, checked_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    """, integration_id, result.get("loginSuccess", False),
         result.get("menuAccessible", False), result.get("uiChangesDetected", False),
         result.get("responseTimeMs", 0), json.dumps(result.get("selectorHealth", {})),
         result.get("error"))

    # Update integration status based on health
    new_status = "active" if result.get("loginSuccess") and result.get("menuAccessible") else "error"
    await db.execute("""
        UPDATE toast_integrations
        SET status = $2, last_error = $3, updated_at = NOW()
        WHERE id = $1
    """, integration_id, new_status, result.get("error"))

    return ToastHealthCheck(
        integration_id=integration_id,
        restaurant_name=integration["restaurant_name"],
        toast_guid=integration["toast_guid"],
        status=new_status,
        login_success=result.get("loginSuccess", False),
        menu_accessible=result.get("menuAccessible", False),
        ui_changes_detected=result.get("uiChangesDetected", False),
        response_time_ms=result.get("responseTimeMs", 0),
        selector_health=result.get("selectorHealth", {}),
        checked_at=datetime.utcnow()
    )


@router.get("/integrations/{integration_id}/health-history")
async def get_health_history(
    integration_id: uuid.UUID,
    days: int = Query(7, ge=1, le=30),
    db=Depends(get_db)
):
    """Get health check history for an integration."""
    rows = await db.fetch("""
        SELECT * FROM toast_health_checks
        WHERE integration_id = $1 AND checked_at > NOW() - $2::interval
        ORDER BY checked_at DESC
    """, integration_id, f"{days} days")

    return {
        "integration_id": str(integration_id),
        "period_days": days,
        "checks": [
            {
                "login_success": row["login_success"],
                "menu_accessible": row["menu_accessible"],
                "ui_changes_detected": row["ui_changes_detected"],
                "response_time_ms": row["response_time_ms"],
                "error": row["error"],
                "checked_at": row["checked_at"].isoformat()
            }
            for row in rows
        ],
        "summary": {
            "total_checks": len(rows),
            "successful": len([r for r in rows if r["login_success"] and r["menu_accessible"]]),
            "failed": len([r for r in rows if not r["login_success"] or not r["menu_accessible"]]),
            "ui_changes_detected": len([r for r in rows if r["ui_changes_detected"]]),
            "avg_response_time": sum(r["response_time_ms"] for r in rows) / len(rows) if rows else 0
        }
    }


# ============================================
# MENU OPERATIONS
# ============================================

@router.get("/integrations/{integration_id}/menus", response_model=ToastMenuSummary)
async def get_menu_summary(integration_id: uuid.UUID, db=Depends(get_db)):
    """Get menu summary for an integration."""
    integration = await db.fetchrow(
        "SELECT * FROM toast_integrations WHERE id = $1",
        integration_id
    )

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    menus = await db.fetch("""
        SELECT id, name, guid, is_active, item_count, modifier_count, synced_at
        FROM toast_menus
        WHERE integration_id = $1
        ORDER BY name
    """, integration_id)

    total_items = await db.fetchval(
        "SELECT COUNT(*) FROM toast_items WHERE integration_id = $1",
        integration_id
    )

    total_modifiers = await db.fetchval(
        "SELECT COUNT(*) FROM toast_modifier_groups WHERE integration_id = $1",
        integration_id
    )

    last_modified = await db.fetchval("""
        SELECT MAX(synced_at) FROM toast_menus WHERE integration_id = $1
    """, integration_id)

    return ToastMenuSummary(
        integration_id=integration_id,
        toast_guid=integration["toast_guid"],
        menus=[dict(m) for m in menus],
        total_items=total_items or 0,
        total_modifiers=total_modifiers or 0,
        last_modified=last_modified,
        fetched_at=datetime.utcnow()
    )


@router.post("/integrations/{integration_id}/sync-menus")
async def sync_menus(
    integration_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db=Depends(get_db),
    redis=Depends(get_redis)
):
    """Trigger a menu sync for an integration."""
    integration = await db.fetchrow(
        "SELECT * FROM toast_integrations WHERE id = $1",
        integration_id
    )

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Create a sync job
    job_id = uuid.uuid4()

    await db.execute("""
        INSERT INTO automation_jobs (
            id, client_id, job_type, status, priority, config,
            created_at, updated_at
        ) VALUES ($1, $2, 'menu_sync', 'queued', 2, $3, NOW(), NOW())
    """, job_id, integration["client_id"], json.dumps({
        "integration_id": str(integration_id),
        "toast_guid": integration["toast_guid"]
    }))

    # Queue job
    await redis.lpush("job_queue:2", str(job_id))

    return {
        "status": "queued",
        "job_id": str(job_id),
        "integration_id": str(integration_id)
    }


# ============================================
# GOLDEN COPY ENDPOINTS
# ============================================

@router.post("/integrations/{integration_id}/golden-copy/capture")
async def capture_golden_copy(
    integration_id: uuid.UUID,
    pages: List[str] = ["login", "menu_list", "item_editor"],
    db=Depends(get_db)
):
    """Capture golden copy baselines for UI change detection."""
    integration = await db.fetchrow(
        "SELECT * FROM toast_integrations WHERE id = $1",
        integration_id
    )

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Decrypt credentials
    password = fernet.decrypt(integration["encrypted_password"].encode()).decode()
    totp_secret = None
    if integration["encrypted_totp_secret"]:
        totp_secret = fernet.decrypt(integration["encrypted_totp_secret"].encode()).decode()

    # Call browser-service to capture baselines
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://browser-service:3000/toast/capture-golden-copy",
                json={
                    "clientId": str(integration_id),
                    "toastGuid": integration["toast_guid"],
                    "credentials": {
                        "username": integration["username"],
                        "password": password,
                        "totpSecret": totp_secret
                    },
                    "pages": pages
                },
                timeout=300.0
            )
            response.raise_for_status()
            result = response.json()

            # Store baselines
            for page_result in result.get("baselines", []):
                await db.execute("""
                    INSERT INTO toast_golden_copies (
                        integration_id, page_name, screenshot_path,
                        selectors_hash, captured_at
                    ) VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (integration_id, page_name)
                    DO UPDATE SET screenshot_path = $3, selectors_hash = $4, captured_at = NOW()
                """, integration_id, page_result["page"],
                     page_result.get("screenshotPath"),
                     page_result.get("selectorsHash"))

            return {
                "status": "captured",
                "integration_id": str(integration_id),
                "pages_captured": [p["page"] for p in result.get("baselines", [])],
                "captured_at": datetime.utcnow().isoformat()
            }

    except httpx.RequestError as e:
        logger.error(f"Golden copy capture failed: {e}")
        raise HTTPException(status_code=503, detail=f"Browser service error: {e}")


@router.post("/integrations/{integration_id}/golden-copy/compare", response_model=List[GoldenCopyResult])
async def compare_golden_copy(integration_id: uuid.UUID, db=Depends(get_db)):
    """Compare current UI state against golden copy baselines."""
    integration = await db.fetchrow(
        "SELECT * FROM toast_integrations WHERE id = $1",
        integration_id
    )

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Get existing baselines
    baselines = await db.fetch("""
        SELECT page_name, screenshot_path, selectors_hash
        FROM toast_golden_copies
        WHERE integration_id = $1
    """, integration_id)

    if not baselines:
        raise HTTPException(status_code=400, detail="No golden copy baselines found. Capture first.")

    # Decrypt credentials
    password = fernet.decrypt(integration["encrypted_password"].encode()).decode()
    totp_secret = None
    if integration["encrypted_totp_secret"]:
        totp_secret = fernet.decrypt(integration["encrypted_totp_secret"].encode()).decode()

    # Call browser-service to compare
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://browser-service:3000/toast/compare-golden-copy",
                json={
                    "clientId": str(integration_id),
                    "toastGuid": integration["toast_guid"],
                    "credentials": {
                        "username": integration["username"],
                        "password": password,
                        "totpSecret": totp_secret
                    },
                    "baselines": [dict(b) for b in baselines]
                },
                timeout=300.0
            )
            response.raise_for_status()
            results = response.json()

            return [
                GoldenCopyResult(
                    integration_id=integration_id,
                    page_name=r["page"],
                    match=r.get("match", False),
                    similarity_score=r.get("similarityScore", 0),
                    differences=r.get("differences", []),
                    screenshot_path=r.get("screenshotPath"),
                    captured_at=datetime.utcnow()
                )
                for r in results.get("comparisons", [])
            ]

    except httpx.RequestError as e:
        logger.error(f"Golden copy comparison failed: {e}")
        raise HTTPException(status_code=503, detail=f"Browser service error: {e}")


# ============================================
# JOB OPERATIONS
# ============================================

@router.post("/jobs")
async def create_toast_job(
    request: ToastJobRequest,
    db=Depends(get_db),
    redis=Depends(get_redis)
):
    """Create a Toast-specific automation job."""
    integration = await db.fetchrow(
        "SELECT * FROM toast_integrations WHERE id = $1",
        request.integration_id
    )

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    job_id = uuid.uuid4()
    config = {
        **request.config,
        "integration_id": str(request.integration_id),
        "toast_guid": integration["toast_guid"]
    }

    scheduled_at = request.scheduled_at or datetime.utcnow()

    await db.execute("""
        INSERT INTO automation_jobs (
            id, client_id, job_type, status, priority, config,
            scheduled_at, created_at, updated_at
        ) VALUES ($1, $2, $3, 'queued', $4, $5, $6, NOW(), NOW())
    """, job_id, integration["client_id"], request.job_type,
         request.priority, json.dumps(config), scheduled_at)

    # Queue job
    await redis.lpush(f"job_queue:{request.priority}", str(job_id))

    return {
        "status": "queued",
        "job_id": str(job_id),
        "job_type": request.job_type,
        "integration_id": str(request.integration_id)
    }


# ============================================
# HELPER FUNCTIONS
# ============================================

def _row_to_integration_response(row: dict) -> ToastIntegrationResponse:
    """Convert database row to ToastIntegrationResponse."""
    # Calculate health score
    health_score = 100
    if row.get("last_error"):
        health_score -= 30
    if row.get("status") == "error":
        health_score -= 40
    elif row.get("status") == "inactive":
        health_score -= 20

    return ToastIntegrationResponse(
        id=row["id"],
        client_id=row["client_id"],
        restaurant_id=row["restaurant_id"],
        toast_guid=row["toast_guid"],
        username=row["username"],
        status=ToastIntegrationStatus(row["status"]),
        last_login_at=row.get("last_login_at"),
        last_sync_at=row.get("last_sync_at"),
        last_error=row.get("last_error"),
        menu_count=row.get("menu_count", 0),
        item_count=row.get("item_count", 0),
        modifier_group_count=row.get("modifier_group_count", 0),
        health_score=max(0, health_score),
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )
