"""
R&G Consulting Local Control Center API
FastAPI application for managing client data, quotes, menus, and sync operations.
"""

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncpg
import redis.asyncio as redis
from miniopy_async import Minio
import os
import logging
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://rg_admin:changeme@localhost:5432/rg_consulting")
REDIS_URL = os.getenv("REDIS_URL", "redis://:changeme@localhost:6379/0")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "rg_admin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "changeme123")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "rg-files")
CLIENT_FILES_PATH = os.getenv("CLIENT_FILES_PATH", "/app/client_files")

# Global connections
db_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[redis.Redis] = None
minio_client: Optional[Minio] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    global db_pool, redis_client, minio_client
    
    # Startup
    logger.info("Starting R&G Consulting Control Center API...")
    
    try:
        # PostgreSQL connection pool
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)
        logger.info("PostgreSQL connection pool created")
        
        # Redis connection
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        await redis_client.ping()
        logger.info("Redis connection established")
        
        # MinIO connection
        minio_client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=False
        )
        if not await minio_client.bucket_exists(MINIO_BUCKET):
            await minio_client.make_bucket(MINIO_BUCKET)
            logger.info(f"Created MinIO bucket: {MINIO_BUCKET}")
        logger.info("MinIO connection established")
        
    except Exception as e:
        logger.error(f"Startup error: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    if db_pool:
        await db_pool.close()
    if redis_client:
        await redis_client.close()


app = FastAPI(
    title="R&G Consulting Control Center",
    description="Local API for managing restaurant consulting business operations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# PYDANTIC MODELS
# ============================================

class ClientBase(BaseModel):
    email: EmailStr
    name: str
    company: str
    slug: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    portal_enabled: bool = False
    support_plan_tier: Optional[str] = None
    support_plan_status: Optional[str] = None
    notes: Optional[str] = None
    timezone: str = "America/New_York"


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    portal_enabled: Optional[bool] = None
    support_plan_tier: Optional[str] = None
    support_plan_status: Optional[str] = None
    notes: Optional[str] = None


class ClientResponse(ClientBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    restaurant_count: int = 0
    project_count: int = 0
    
    class Config:
        from_attributes = True


class RestaurantBase(BaseModel):
    name: str
    client_id: uuid.UUID
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    phone: Optional[str] = None
    pos_system: Optional[str] = None
    number_of_stations: Optional[int] = None
    monthly_volume: Optional[float] = None
    cuisine_type: Optional[str] = None
    service_style: Optional[str] = None


class RestaurantCreate(RestaurantBase):
    pass


class RestaurantResponse(RestaurantBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    database: str
    redis: str
    minio: str
    version: str


class SyncStatus(BaseModel):
    pending_to_cloud: int
    pending_from_cloud: int
    last_sync_at: Optional[datetime]
    status: str


# ============================================
# HEALTH & STATUS ENDPOINTS
# ============================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check health of all services."""
    db_status = "unknown"
    redis_status = "unknown"
    minio_status = "unknown"
    
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    try:
        await redis_client.ping()
        redis_status = "healthy"
    except Exception as e:
        redis_status = f"error: {str(e)}"
    
    try:
        await minio_client.bucket_exists(MINIO_BUCKET)
        minio_status = "healthy"
    except Exception as e:
        minio_status = f"error: {str(e)}"
    
    overall = "healthy" if all(s == "healthy" for s in [db_status, redis_status, minio_status]) else "degraded"
    
    return HealthResponse(
        status=overall,
        timestamp=datetime.utcnow(),
        database=db_status,
        redis=redis_status,
        minio=minio_status,
        version="1.0.0"
    )


@app.get("/sync/status", response_model=SyncStatus)
async def get_sync_status():
    """Get current sync queue status."""
    async with db_pool.acquire() as conn:
        pending_to = await conn.fetchval(
            "SELECT COUNT(*) FROM sync_queue WHERE status = 'pending' AND direction = 'to_cloud'"
        )
        pending_from = await conn.fetchval(
            "SELECT COUNT(*) FROM sync_queue WHERE status = 'pending' AND direction = 'from_cloud'"
        )
        last_sync = await conn.fetchval(
            "SELECT MAX(processed_at) FROM sync_queue WHERE status = 'completed'"
        )
    
    return SyncStatus(
        pending_to_cloud=pending_to or 0,
        pending_from_cloud=pending_from or 0,
        last_sync_at=last_sync,
        status="active" if pending_to + pending_from > 0 else "idle"
    )


# ============================================
# CLIENT ENDPOINTS
# ============================================

@app.get("/clients", response_model=List[ClientResponse])
async def list_clients(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None
):
    """List all clients with optional search."""
    async with db_pool.acquire() as conn:
        if search:
            query = """
                SELECT c.*, 
                       (SELECT COUNT(*) FROM restaurants WHERE client_id = c.id) as restaurant_count,
                       (SELECT COUNT(*) FROM projects WHERE client_id = c.id) as project_count
                FROM clients c
                WHERE c.name ILIKE $1 OR c.company ILIKE $1 OR c.email ILIKE $1
                ORDER BY c.created_at DESC
                LIMIT $2 OFFSET $3
            """
            rows = await conn.fetch(query, f"%{search}%", limit, skip)
        else:
            query = """
                SELECT c.*, 
                       (SELECT COUNT(*) FROM restaurants WHERE client_id = c.id) as restaurant_count,
                       (SELECT COUNT(*) FROM projects WHERE client_id = c.id) as project_count
                FROM clients c
                ORDER BY c.created_at DESC
                LIMIT $1 OFFSET $2
            """
            rows = await conn.fetch(query, limit, skip)
    
    return [dict(row) for row in rows]


@app.get("/clients/{client_id}", response_model=ClientResponse)
async def get_client(client_id: uuid.UUID):
    """Get a specific client by ID."""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT c.*, 
                   (SELECT COUNT(*) FROM restaurants WHERE client_id = c.id) as restaurant_count,
                   (SELECT COUNT(*) FROM projects WHERE client_id = c.id) as project_count
            FROM clients c
            WHERE c.id = $1
        """, client_id)
    
    if not row:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return dict(row)


@app.post("/clients", response_model=ClientResponse)
async def create_client(client: ClientCreate):
    """Create a new client."""
    async with db_pool.acquire() as conn:
        # Generate slug if not provided
        slug = client.slug or client.company.lower().replace(" ", "-").replace("'", "")[:50]
        
        # Check for duplicate slug
        existing = await conn.fetchval("SELECT id FROM clients WHERE slug = $1", slug)
        if existing:
            slug = f"{slug}-{uuid.uuid4().hex[:6]}"
        
        row = await conn.fetchrow("""
            INSERT INTO clients (email, name, company, slug, phone, address, city, state, zip,
                                portal_enabled, support_plan_tier, support_plan_status, notes, timezone)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *, 0 as restaurant_count, 0 as project_count
        """, client.email, client.name, client.company, slug, client.phone,
             client.address, client.city, client.state, client.zip,
             client.portal_enabled, client.support_plan_tier, client.support_plan_status,
             client.notes, client.timezone)
        
        # Queue for cloud sync
        await conn.execute("""
            INSERT INTO sync_queue (entity_type, entity_id, action, payload)
            VALUES ('client', $1, 'create', $2)
        """, row['id'], dict(row))
    
    logger.info(f"Created client: {row['id']} - {client.company}")
    return dict(row)


@app.patch("/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: uuid.UUID, client: ClientUpdate):
    """Update an existing client."""
    async with db_pool.acquire() as conn:
        # Get current client
        existing = await conn.fetchrow("SELECT * FROM clients WHERE id = $1", client_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Build update query dynamically
        updates = []
        values = []
        param_num = 1
        
        for field, value in client.dict(exclude_unset=True).items():
            if value is not None:
                updates.append(f"{field} = ${param_num}")
                values.append(value)
                param_num += 1
        
        if not updates:
            return dict(existing)
        
        values.append(client_id)
        query = f"""
            UPDATE clients SET {', '.join(updates)}, updated_at = NOW()
            WHERE id = ${param_num}
            RETURNING *, 
                (SELECT COUNT(*) FROM restaurants WHERE client_id = clients.id) as restaurant_count,
                (SELECT COUNT(*) FROM projects WHERE client_id = clients.id) as project_count
        """
        
        row = await conn.fetchrow(query, *values)
        
        # Queue for cloud sync
        await conn.execute("""
            INSERT INTO sync_queue (entity_type, entity_id, action, payload)
            VALUES ('client', $1, 'update', $2)
        """, client_id, dict(row))
    
    return dict(row)


@app.delete("/clients/{client_id}")
async def delete_client(client_id: uuid.UUID):
    """Delete a client (soft delete by setting a flag, or hard delete)."""
    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM clients WHERE id = $1", client_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Client not found")
        
        await conn.execute("DELETE FROM clients WHERE id = $1", client_id)
        
        # Queue for cloud sync
        await conn.execute("""
            INSERT INTO sync_queue (entity_type, entity_id, action)
            VALUES ('client', $1, 'delete')
        """, client_id)
    
    return {"status": "deleted", "id": str(client_id)}


# ============================================
# RESTAURANT ENDPOINTS
# ============================================

@app.get("/clients/{client_id}/restaurants", response_model=List[RestaurantResponse])
async def list_client_restaurants(client_id: uuid.UUID):
    """List all restaurants for a client."""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM restaurants WHERE client_id = $1 ORDER BY name
        """, client_id)
    
    return [dict(row) for row in rows]


@app.post("/clients/{client_id}/restaurants", response_model=RestaurantResponse)
async def create_restaurant(client_id: uuid.UUID, restaurant: RestaurantCreate):
    """Create a new restaurant for a client."""
    if restaurant.client_id != client_id:
        raise HTTPException(status_code=400, detail="Client ID mismatch")
    
    async with db_pool.acquire() as conn:
        # Verify client exists
        client = await conn.fetchval("SELECT id FROM clients WHERE id = $1", client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        row = await conn.fetchrow("""
            INSERT INTO restaurants (client_id, name, address, city, state, zip, phone,
                                    pos_system, number_of_stations, monthly_volume,
                                    cuisine_type, service_style)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        """, client_id, restaurant.name, restaurant.address, restaurant.city,
             restaurant.state, restaurant.zip, restaurant.phone, restaurant.pos_system,
             restaurant.number_of_stations, restaurant.monthly_volume,
             restaurant.cuisine_type, restaurant.service_style)
    
    return dict(row)


# ============================================
# DASHBOARD ENDPOINTS
# ============================================

@app.get("/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics."""
    async with db_pool.acquire() as conn:
        stats = await conn.fetchrow("""
            SELECT
                (SELECT COUNT(*) FROM clients) as total_clients,
                (SELECT COUNT(*) FROM clients WHERE support_plan_status = 'active') as active_support_plans,
                (SELECT COUNT(*) FROM restaurants) as total_restaurants,
                (SELECT COUNT(*) FROM projects WHERE status = 'in_progress') as active_projects,
                (SELECT COUNT(*) FROM tickets WHERE status IN ('open', 'in_progress')) as open_tickets,
                (SELECT COUNT(*) FROM quotes WHERE status = 'draft') as pending_quotes,
                (SELECT COUNT(*) FROM sync_queue WHERE status = 'pending') as pending_syncs
        """)
    
    return dict(stats)


@app.get("/dashboard/recent-activity")
async def get_recent_activity(limit: int = Query(20, ge=1, le=100)):
    """Get recent activity log entries."""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM activity_log
            ORDER BY created_at DESC
            LIMIT $1
        """, limit)
    
    return [dict(row) for row in rows]


# ============================================
# RUN SERVER
# ============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
