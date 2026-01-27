"""
Automation Router - Job Queue Management and Orchestration

Handles automation job lifecycle:
- Job creation and scheduling
- Real-time status updates via WebSocket
- Job execution delegation to browser-service
- Recovery and retry logic
"""

from fastapi import APIRouter, HTTPException, Query, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import uuid
import json
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/automation", tags=["Automation"])


# ============================================
# ENUMS & MODELS
# ============================================

class JobStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(str, Enum):
    MENU_BUILD = "menu_build"
    MENU_SYNC = "menu_sync"
    ITEM_CREATE = "item_create"
    ITEM_UPDATE = "item_update"
    MODIFIER_SYNC = "modifier_sync"
    HEALTH_CHECK = "health_check"
    GOLDEN_COPY = "golden_copy"
    CLASSIFICATION = "classification"
    REPORT_GENERATION = "report_generation"
    BACKUP = "backup"


class JobPriority(int, Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


class CreateJobRequest(BaseModel):
    client_id: uuid.UUID
    job_type: JobType
    priority: JobPriority = JobPriority.NORMAL
    config: Dict[str, Any] = Field(default_factory=dict)
    scheduled_at: Optional[datetime] = None
    depends_on: Optional[List[uuid.UUID]] = None
    retry_on_failure: bool = True
    max_retries: int = 3
    timeout_seconds: int = 3600
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UpdateJobRequest(BaseModel):
    status: Optional[JobStatus] = None
    priority: Optional[JobPriority] = None
    config: Optional[Dict[str, Any]] = None
    scheduled_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


class JobResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: Optional[str] = None
    job_type: JobType
    status: JobStatus
    priority: JobPriority
    config: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: int = 0
    progress_message: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    retry_count: int = 0
    max_retries: int = 3
    depends_on: List[uuid.UUID] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class JobQueueStats(BaseModel):
    total_jobs: int
    pending: int
    queued: int
    running: int
    completed_today: int
    failed_today: int
    avg_duration_seconds: float
    by_type: Dict[str, int]
    by_priority: Dict[str, int]


class BrowserSessionInfo(BaseModel):
    session_id: str
    client_id: str
    created_at: datetime
    last_activity: datetime
    is_authenticated: bool
    toast_guid: Optional[str] = None
    current_page: Optional[str] = None


# ============================================
# WEBSOCKET CONNECTION MANAGER
# ============================================

class ConnectionManager:
    """Manages WebSocket connections for real-time job updates."""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.client_subscriptions: Dict[str, List[str]] = {}  # ws_id -> [job_ids]

    async def connect(self, websocket: WebSocket, client_id: str = "global"):
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        logger.info(f"WebSocket connected for client: {client_id}")

    def disconnect(self, websocket: WebSocket, client_id: str = "global"):
        if client_id in self.active_connections:
            self.active_connections[client_id].remove(websocket)
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
        logger.info(f"WebSocket disconnected for client: {client_id}")

    async def broadcast_to_client(self, client_id: str, message: dict):
        """Send message to all connections for a client."""
        connections = self.active_connections.get(client_id, [])
        connections.extend(self.active_connections.get("global", []))

        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send WebSocket message: {e}")

    async def broadcast_job_update(self, job: dict):
        """Broadcast job status update to relevant clients."""
        message = {
            "type": "job_update",
            "job_id": str(job["id"]),
            "status": job["status"],
            "progress": job.get("progress", 0),
            "progress_message": job.get("progress_message"),
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast_to_client(str(job["client_id"]), message)


manager = ConnectionManager()


# ============================================
# DEPENDENCY INJECTION
# ============================================

async def get_db():
    """Get database connection from app state."""
    from ..main import db_pool
    async with db_pool.acquire() as conn:
        yield conn


async def get_redis():
    """Get Redis client from app state."""
    from ..main import redis_client
    return redis_client


# ============================================
# JOB QUEUE ENDPOINTS
# ============================================

@router.get("/jobs", response_model=List[JobResponse])
async def list_jobs(
    status: Optional[JobStatus] = None,
    job_type: Optional[JobType] = None,
    client_id: Optional[uuid.UUID] = None,
    priority: Optional[JobPriority] = None,
    since: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db=Depends(get_db)
):
    """List automation jobs with filtering."""
    query = """
        SELECT j.*, c.name as client_name
        FROM automation_jobs j
        LEFT JOIN clients c ON j.client_id = c.id
        WHERE 1=1
    """
    params = []
    param_idx = 1

    if status:
        query += f" AND j.status = ${param_idx}"
        params.append(status.value)
        param_idx += 1

    if job_type:
        query += f" AND j.job_type = ${param_idx}"
        params.append(job_type.value)
        param_idx += 1

    if client_id:
        query += f" AND j.client_id = ${param_idx}"
        params.append(client_id)
        param_idx += 1

    if priority is not None:
        query += f" AND j.priority = ${param_idx}"
        params.append(priority.value)
        param_idx += 1

    if since:
        query += f" AND j.created_at >= ${param_idx}"
        params.append(since)
        param_idx += 1

    query += f" ORDER BY j.priority DESC, j.created_at DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}"
    params.extend([limit, offset])

    rows = await db.fetch(query, *params)
    return [_row_to_job_response(row) for row in rows]


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: uuid.UUID, db=Depends(get_db)):
    """Get a specific job by ID."""
    row = await db.fetchrow("""
        SELECT j.*, c.name as client_name
        FROM automation_jobs j
        LEFT JOIN clients c ON j.client_id = c.id
        WHERE j.id = $1
    """, job_id)

    if not row:
        raise HTTPException(status_code=404, detail="Job not found")

    return _row_to_job_response(row)


@router.post("/jobs", response_model=JobResponse, status_code=201)
async def create_job(request: CreateJobRequest, db=Depends(get_db), redis=Depends(get_redis)):
    """Create a new automation job."""
    # Verify client exists
    client = await db.fetchrow("SELECT id, name FROM clients WHERE id = $1", request.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Check dependencies
    if request.depends_on:
        for dep_id in request.depends_on:
            dep = await db.fetchrow("SELECT id, status FROM automation_jobs WHERE id = $1", dep_id)
            if not dep:
                raise HTTPException(status_code=400, detail=f"Dependency job {dep_id} not found")

    job_id = uuid.uuid4()
    scheduled_at = request.scheduled_at or datetime.utcnow()

    # Determine initial status
    initial_status = JobStatus.PENDING
    if request.depends_on:
        # Check if dependencies are completed
        incomplete = await db.fetchval("""
            SELECT COUNT(*) FROM automation_jobs
            WHERE id = ANY($1) AND status != 'completed'
        """, request.depends_on)
        if incomplete > 0:
            initial_status = JobStatus.PENDING
        else:
            initial_status = JobStatus.QUEUED
    elif scheduled_at <= datetime.utcnow():
        initial_status = JobStatus.QUEUED

    row = await db.fetchrow("""
        INSERT INTO automation_jobs (
            id, client_id, job_type, status, priority, config,
            scheduled_at, depends_on, retry_on_failure, max_retries,
            timeout_seconds, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING *, (SELECT name FROM clients WHERE id = $2) as client_name
    """, job_id, request.client_id, request.job_type.value, initial_status.value,
         request.priority.value, json.dumps(request.config), scheduled_at,
         request.depends_on or [], request.retry_on_failure, request.max_retries,
         request.timeout_seconds, json.dumps(request.metadata))

    job = _row_to_job_response(row)

    # Queue job in Redis for processing
    if initial_status == JobStatus.QUEUED:
        await redis.lpush(f"job_queue:{request.priority.value}", str(job_id))

    # Broadcast creation
    await manager.broadcast_job_update({
        "id": job_id,
        "client_id": request.client_id,
        "status": initial_status.value,
        "progress": 0
    })

    logger.info(f"Created job {job_id} for client {client['name']}: {request.job_type}")
    return job


@router.patch("/jobs/{job_id}", response_model=JobResponse)
async def update_job(job_id: uuid.UUID, request: UpdateJobRequest, db=Depends(get_db)):
    """Update a job's status or configuration."""
    existing = await db.fetchrow("SELECT * FROM automation_jobs WHERE id = $1", job_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Job not found")

    # Build update
    updates = []
    params = []
    param_idx = 1

    if request.status:
        updates.append(f"status = ${param_idx}")
        params.append(request.status.value)
        param_idx += 1

        # Set timestamps
        if request.status == JobStatus.RUNNING:
            updates.append(f"started_at = NOW()")
        elif request.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
            updates.append(f"completed_at = NOW()")

    if request.priority is not None:
        updates.append(f"priority = ${param_idx}")
        params.append(request.priority.value)
        param_idx += 1

    if request.config is not None:
        updates.append(f"config = ${param_idx}")
        params.append(json.dumps(request.config))
        param_idx += 1

    if request.scheduled_at:
        updates.append(f"scheduled_at = ${param_idx}")
        params.append(request.scheduled_at)
        param_idx += 1

    if request.metadata is not None:
        updates.append(f"metadata = ${param_idx}")
        params.append(json.dumps(request.metadata))
        param_idx += 1

    if not updates:
        return _row_to_job_response(existing)

    params.append(job_id)
    query = f"""
        UPDATE automation_jobs
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = ${param_idx}
        RETURNING *, (SELECT name FROM clients WHERE id = client_id) as client_name
    """

    row = await db.fetchrow(query, *params)
    job = _row_to_job_response(row)

    # Broadcast update
    await manager.broadcast_job_update({
        "id": job_id,
        "client_id": job.client_id,
        "status": job.status,
        "progress": job.progress
    })

    return job


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: uuid.UUID, db=Depends(get_db)):
    """Cancel a pending or running job."""
    row = await db.fetchrow("""
        UPDATE automation_jobs
        SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status IN ('pending', 'queued', 'running', 'paused')
        RETURNING *
    """, job_id)

    if not row:
        raise HTTPException(status_code=400, detail="Job cannot be cancelled or not found")

    # Broadcast cancellation
    await manager.broadcast_job_update({
        "id": job_id,
        "client_id": row["client_id"],
        "status": "cancelled"
    })

    return {"status": "cancelled", "job_id": str(job_id)}


@router.post("/jobs/{job_id}/retry")
async def retry_job(job_id: uuid.UUID, db=Depends(get_db), redis=Depends(get_redis)):
    """Retry a failed job."""
    row = await db.fetchrow("""
        UPDATE automation_jobs
        SET status = 'queued',
            started_at = NULL,
            completed_at = NULL,
            error = NULL,
            result = NULL,
            retry_count = retry_count + 1,
            updated_at = NOW()
        WHERE id = $1 AND status IN ('failed', 'cancelled')
        RETURNING *
    """, job_id)

    if not row:
        raise HTTPException(status_code=400, detail="Job cannot be retried or not found")

    # Re-queue
    await redis.lpush(f"job_queue:{row['priority']}", str(job_id))

    # Broadcast
    await manager.broadcast_job_update({
        "id": job_id,
        "client_id": row["client_id"],
        "status": "queued"
    })

    return {"status": "requeued", "job_id": str(job_id), "retry_count": row["retry_count"]}


@router.get("/jobs/stats", response_model=JobQueueStats)
async def get_job_stats(db=Depends(get_db)):
    """Get job queue statistics."""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    stats = await db.fetchrow("""
        SELECT
            COUNT(*) as total_jobs,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'queued') as queued,
            COUNT(*) FILTER (WHERE status = 'running') as running,
            COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= $1) as completed_today,
            COUNT(*) FILTER (WHERE status = 'failed' AND completed_at >= $1) as failed_today,
            COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE completed_at IS NOT NULL), 0) as avg_duration
        FROM automation_jobs
    """, today)

    # By type
    type_stats = await db.fetch("""
        SELECT job_type, COUNT(*) as count
        FROM automation_jobs
        WHERE status IN ('pending', 'queued', 'running')
        GROUP BY job_type
    """)

    # By priority
    priority_stats = await db.fetch("""
        SELECT priority, COUNT(*) as count
        FROM automation_jobs
        WHERE status IN ('pending', 'queued', 'running')
        GROUP BY priority
    """)

    return JobQueueStats(
        total_jobs=stats["total_jobs"],
        pending=stats["pending"],
        queued=stats["queued"],
        running=stats["running"],
        completed_today=stats["completed_today"],
        failed_today=stats["failed_today"],
        avg_duration_seconds=float(stats["avg_duration"] or 0),
        by_type={row["job_type"]: row["count"] for row in type_stats},
        by_priority={str(row["priority"]): row["count"] for row in priority_stats}
    )


# ============================================
# BROWSER SESSION ENDPOINTS
# ============================================

@router.get("/sessions", response_model=List[BrowserSessionInfo])
async def list_browser_sessions():
    """Get all active browser sessions from browser-service."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "http://browser-service:3000/sessions",
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()
    except httpx.RequestError as e:
        logger.error(f"Failed to get browser sessions: {e}")
        raise HTTPException(status_code=503, detail="Browser service unavailable")


@router.post("/sessions/{client_id}/terminate")
async def terminate_session(client_id: str):
    """Terminate a browser session."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"http://browser-service:3000/session/{client_id}",
                timeout=10.0
            )
            response.raise_for_status()
            return {"status": "terminated", "client_id": client_id}
    except httpx.RequestError as e:
        logger.error(f"Failed to terminate session: {e}")
        raise HTTPException(status_code=503, detail="Browser service unavailable")


# ============================================
# WEBSOCKET ENDPOINT
# ============================================

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str = "global"):
    """WebSocket endpoint for real-time job updates."""
    await manager.connect(websocket, client_id)
    try:
        while True:
            # Receive commands from client
            data = await websocket.receive_text()
            try:
                message = json.loads(data)

                if message.get("type") == "subscribe":
                    # Subscribe to specific job updates
                    job_id = message.get("job_id")
                    if job_id:
                        ws_id = id(websocket)
                        if ws_id not in manager.client_subscriptions:
                            manager.client_subscriptions[ws_id] = []
                        manager.client_subscriptions[ws_id].append(job_id)

                elif message.get("type") == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": datetime.utcnow().isoformat()})

            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)


# ============================================
# HELPER FUNCTIONS
# ============================================

def _row_to_job_response(row: dict) -> JobResponse:
    """Convert database row to JobResponse."""
    return JobResponse(
        id=row["id"],
        client_id=row["client_id"],
        client_name=row.get("client_name"),
        job_type=JobType(row["job_type"]),
        status=JobStatus(row["status"]),
        priority=JobPriority(row["priority"]),
        config=json.loads(row["config"]) if isinstance(row["config"], str) else row["config"] or {},
        result=json.loads(row["result"]) if row.get("result") and isinstance(row["result"], str) else row.get("result"),
        error=row.get("error"),
        progress=row.get("progress", 0),
        progress_message=row.get("progress_message"),
        scheduled_at=row.get("scheduled_at"),
        started_at=row.get("started_at"),
        completed_at=row.get("completed_at"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        retry_count=row.get("retry_count", 0),
        max_retries=row.get("max_retries", 3),
        depends_on=row.get("depends_on") or [],
        metadata=json.loads(row["metadata"]) if row.get("metadata") and isinstance(row["metadata"], str) else row.get("metadata") or {}
    )
