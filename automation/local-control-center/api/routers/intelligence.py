"""
Intelligence Router - The "Brain" Decision Engine

Provides intelligent decision-making for the Autonomous Architect:
- Automated job scheduling and prioritization
- Client health scoring and recommendations
- Anomaly detection and alerting
- Predictive maintenance for Toast integrations
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/intelligence", tags=["Intelligence Engine"])


# ============================================
# MODELS
# ============================================

class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class RecommendationType(str, Enum):
    MAINTENANCE = "maintenance"
    OPTIMIZATION = "optimization"
    SECURITY = "security"
    COST_SAVING = "cost_saving"
    TRAINING = "training"
    UPSELL = "upsell"


class ClientHealthScore(BaseModel):
    client_id: uuid.UUID
    client_name: str
    overall_score: int = Field(ge=0, le=100)
    health_status: HealthStatus
    factors: Dict[str, int]
    trend: str  # improving, stable, declining
    last_interaction: Optional[datetime]
    recommendations: List[Dict[str, Any]]
    computed_at: datetime


class SystemHealthReport(BaseModel):
    status: HealthStatus
    components: Dict[str, Dict[str, Any]]
    alerts: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    timestamp: datetime


class Alert(BaseModel):
    id: uuid.UUID
    severity: AlertSeverity
    category: str
    title: str
    message: str
    client_id: Optional[uuid.UUID] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime


class Recommendation(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    recommendation_type: RecommendationType
    title: str
    description: str
    impact_score: int = Field(ge=0, le=100)
    effort_score: int = Field(ge=0, le=100)
    priority: int = Field(ge=0, le=10)
    action_items: List[str]
    estimated_value: Optional[float] = None
    status: str = "pending"  # pending, accepted, declined, completed
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    expires_at: Optional[datetime] = None


class DecisionRequest(BaseModel):
    context: str  # What decision needs to be made
    client_id: Optional[uuid.UUID] = None
    constraints: Dict[str, Any] = Field(default_factory=dict)
    options: List[Dict[str, Any]] = Field(default_factory=list)


class DecisionResponse(BaseModel):
    decision: str
    confidence: float
    reasoning: str
    alternatives: List[Dict[str, Any]]
    risk_factors: List[str]
    recommended_actions: List[str]


class JobScheduleRecommendation(BaseModel):
    job_type: str
    client_id: uuid.UUID
    recommended_time: datetime
    reason: str
    priority: int
    conflict_score: float  # 0-1, lower is better


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
# CLIENT HEALTH ENDPOINTS
# ============================================

@router.get("/clients/{client_id}/health", response_model=ClientHealthScore)
async def get_client_health(client_id: uuid.UUID, db=Depends(get_db)):
    """Calculate and return client health score."""
    # Get client info
    client = await db.fetchrow("SELECT * FROM clients WHERE id = $1", client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Calculate health factors
    factors = await _calculate_health_factors(db, client_id)

    # Calculate overall score (weighted average)
    weights = {
        "engagement": 0.25,
        "automation_success": 0.20,
        "support_responsiveness": 0.15,
        "payment_health": 0.15,
        "system_stability": 0.15,
        "growth_potential": 0.10
    }

    overall_score = sum(factors.get(k, 50) * weights.get(k, 0) for k in weights)
    overall_score = int(min(100, max(0, overall_score)))

    # Determine health status
    if overall_score >= 80:
        health_status = HealthStatus.HEALTHY
    elif overall_score >= 60:
        health_status = HealthStatus.WARNING
    elif overall_score >= 40:
        health_status = HealthStatus.WARNING
    else:
        health_status = HealthStatus.CRITICAL

    # Calculate trend
    trend = await _calculate_health_trend(db, client_id)

    # Generate recommendations
    recommendations = await _generate_client_recommendations(db, client_id, factors)

    # Get last interaction
    last_interaction = await db.fetchval("""
        SELECT MAX(created_at) FROM activity_log WHERE client_id = $1
    """, client_id)

    return ClientHealthScore(
        client_id=client_id,
        client_name=client["name"],
        overall_score=overall_score,
        health_status=health_status,
        factors=factors,
        trend=trend,
        last_interaction=last_interaction,
        recommendations=recommendations,
        computed_at=datetime.utcnow()
    )


@router.get("/clients/health-summary")
async def get_all_clients_health_summary(
    status: Optional[HealthStatus] = None,
    limit: int = Query(50, ge=1, le=200),
    db=Depends(get_db)
):
    """Get health summary for all clients."""
    clients = await db.fetch("""
        SELECT id, name, company FROM clients
        ORDER BY name LIMIT $1
    """, limit)

    summaries = []
    for client in clients:
        try:
            health = await get_client_health(client["id"], db)
            if status is None or health.health_status == status:
                summaries.append({
                    "client_id": str(client["id"]),
                    "client_name": client["name"],
                    "company": client["company"],
                    "score": health.overall_score,
                    "status": health.health_status,
                    "trend": health.trend,
                    "recommendation_count": len(health.recommendations)
                })
        except Exception as e:
            logger.warning(f"Failed to calculate health for {client['id']}: {e}")
            summaries.append({
                "client_id": str(client["id"]),
                "client_name": client["name"],
                "company": client["company"],
                "score": 0,
                "status": HealthStatus.UNKNOWN,
                "trend": "unknown",
                "recommendation_count": 0
            })

    # Sort by score ascending (worst first)
    summaries.sort(key=lambda x: x["score"])

    return {
        "total_clients": len(summaries),
        "by_status": {
            "healthy": len([s for s in summaries if s["status"] == HealthStatus.HEALTHY]),
            "warning": len([s for s in summaries if s["status"] == HealthStatus.WARNING]),
            "critical": len([s for s in summaries if s["status"] == HealthStatus.CRITICAL]),
            "unknown": len([s for s in summaries if s["status"] == HealthStatus.UNKNOWN])
        },
        "clients": summaries
    }


# ============================================
# SYSTEM HEALTH ENDPOINTS
# ============================================

@router.get("/system/health", response_model=SystemHealthReport)
async def get_system_health(db=Depends(get_db), redis=Depends(get_redis)):
    """Get comprehensive system health report."""
    components = {}
    alerts = []

    # Database health
    try:
        db_start = datetime.utcnow()
        await db.fetchval("SELECT 1")
        db_latency = (datetime.utcnow() - db_start).total_seconds() * 1000
        components["database"] = {
            "status": "healthy" if db_latency < 100 else "warning",
            "latency_ms": db_latency,
            "message": "PostgreSQL responsive"
        }
    except Exception as e:
        components["database"] = {"status": "critical", "error": str(e)}
        alerts.append({
            "severity": "critical",
            "category": "database",
            "message": f"Database error: {e}"
        })

    # Redis health
    try:
        redis_start = datetime.utcnow()
        await redis.ping()
        redis_latency = (datetime.utcnow() - redis_start).total_seconds() * 1000
        queue_sizes = {
            "critical": await redis.llen("job_queue:3") or 0,
            "high": await redis.llen("job_queue:2") or 0,
            "normal": await redis.llen("job_queue:1") or 0,
            "low": await redis.llen("job_queue:0") or 0
        }
        components["redis"] = {
            "status": "healthy",
            "latency_ms": redis_latency,
            "queue_sizes": queue_sizes
        }
    except Exception as e:
        components["redis"] = {"status": "critical", "error": str(e)}
        alerts.append({
            "severity": "critical",
            "category": "redis",
            "message": f"Redis error: {e}"
        })

    # Browser service health
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://browser-service:3000/health", timeout=5.0)
            browser_health = response.json()
            components["browser_service"] = {
                "status": "healthy" if response.status_code == 200 else "warning",
                "active_sessions": browser_health.get("activeSessions", 0),
                "memory_usage": browser_health.get("memoryUsage")
            }
    except Exception as e:
        components["browser_service"] = {"status": "unavailable", "error": str(e)}
        alerts.append({
            "severity": "warning",
            "category": "browser_service",
            "message": f"Browser service unavailable: {e}"
        })

    # Job queue health
    job_stats = await db.fetchrow("""
        SELECT
            COUNT(*) FILTER (WHERE status = 'running') as running,
            COUNT(*) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour') as failed_last_hour,
            COUNT(*) FILTER (WHERE status = 'queued' AND created_at < NOW() - INTERVAL '30 minutes') as stale_queued
        FROM automation_jobs
    """)

    if job_stats["failed_last_hour"] > 5:
        alerts.append({
            "severity": "warning",
            "category": "jobs",
            "message": f"{job_stats['failed_last_hour']} jobs failed in the last hour"
        })

    if job_stats["stale_queued"] > 0:
        alerts.append({
            "severity": "warning",
            "category": "jobs",
            "message": f"{job_stats['stale_queued']} jobs have been queued for over 30 minutes"
        })

    components["job_queue"] = {
        "status": "healthy" if job_stats["failed_last_hour"] < 5 else "warning",
        "running_jobs": job_stats["running"],
        "failed_last_hour": job_stats["failed_last_hour"],
        "stale_queued": job_stats["stale_queued"]
    }

    # Calculate overall status
    statuses = [c.get("status", "unknown") for c in components.values()]
    if "critical" in statuses:
        overall_status = HealthStatus.CRITICAL
    elif "warning" in statuses or "unavailable" in statuses:
        overall_status = HealthStatus.WARNING
    else:
        overall_status = HealthStatus.HEALTHY

    # Gather metrics
    metrics = await _gather_system_metrics(db)

    return SystemHealthReport(
        status=overall_status,
        components=components,
        alerts=alerts,
        metrics=metrics,
        timestamp=datetime.utcnow()
    )


# ============================================
# ALERTS ENDPOINTS
# ============================================

@router.get("/alerts", response_model=List[Alert])
async def list_alerts(
    severity: Optional[AlertSeverity] = None,
    acknowledged: Optional[bool] = None,
    client_id: Optional[uuid.UUID] = None,
    limit: int = Query(50, ge=1, le=200),
    db=Depends(get_db)
):
    """List system alerts."""
    query = "SELECT * FROM alerts WHERE 1=1"
    params = []
    param_idx = 1

    if severity:
        query += f" AND severity = ${param_idx}"
        params.append(severity.value)
        param_idx += 1

    if acknowledged is not None:
        query += f" AND acknowledged = ${param_idx}"
        params.append(acknowledged)
        param_idx += 1

    if client_id:
        query += f" AND client_id = ${param_idx}"
        params.append(client_id)
        param_idx += 1

    query += f" ORDER BY created_at DESC LIMIT ${param_idx}"
    params.append(limit)

    rows = await db.fetch(query, *params)
    return [Alert(**dict(row)) for row in rows]


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: uuid.UUID, acknowledged_by: str, db=Depends(get_db)):
    """Acknowledge an alert."""
    result = await db.fetchrow("""
        UPDATE alerts
        SET acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = NOW()
        WHERE id = $1
        RETURNING *
    """, alert_id, acknowledged_by)

    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")

    return {"status": "acknowledged", "alert_id": str(alert_id)}


# ============================================
# RECOMMENDATIONS ENDPOINTS
# ============================================

@router.get("/recommendations", response_model=List[Recommendation])
async def list_recommendations(
    client_id: Optional[uuid.UUID] = None,
    recommendation_type: Optional[RecommendationType] = None,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db=Depends(get_db)
):
    """List recommendations."""
    query = "SELECT * FROM recommendations WHERE 1=1"
    params = []
    param_idx = 1

    if client_id:
        query += f" AND client_id = ${param_idx}"
        params.append(client_id)
        param_idx += 1

    if recommendation_type:
        query += f" AND recommendation_type = ${param_idx}"
        params.append(recommendation_type.value)
        param_idx += 1

    if status:
        query += f" AND status = ${param_idx}"
        params.append(status)
        param_idx += 1

    query += f" ORDER BY priority DESC, impact_score DESC LIMIT ${param_idx}"
    params.append(limit)

    rows = await db.fetch(query, *params)
    return [_row_to_recommendation(row) for row in rows]


@router.post("/recommendations/{rec_id}/accept")
async def accept_recommendation(rec_id: uuid.UUID, db=Depends(get_db)):
    """Accept a recommendation and trigger associated actions."""
    result = await db.fetchrow("""
        UPDATE recommendations
        SET status = 'accepted', updated_at = NOW()
        WHERE id = $1
        RETURNING *
    """, rec_id)

    if not result:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    # TODO: Trigger associated automation jobs based on recommendation type

    return {"status": "accepted", "recommendation_id": str(rec_id)}


@router.post("/recommendations/{rec_id}/decline")
async def decline_recommendation(rec_id: uuid.UUID, reason: str = "", db=Depends(get_db)):
    """Decline a recommendation."""
    metadata = {"decline_reason": reason}

    result = await db.fetchrow("""
        UPDATE recommendations
        SET status = 'declined',
            metadata = metadata || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    """, rec_id, json.dumps(metadata))

    if not result:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    return {"status": "declined", "recommendation_id": str(rec_id)}


# ============================================
# DECISION ENGINE ENDPOINTS
# ============================================

@router.post("/decide", response_model=DecisionResponse)
async def make_decision(request: DecisionRequest, db=Depends(get_db)):
    """
    Use the intelligence engine to make a decision.

    This endpoint analyzes the context and constraints to provide
    an intelligent recommendation with reasoning.
    """
    # Gather relevant data based on context
    context_data = {}

    if request.client_id:
        client = await db.fetchrow("SELECT * FROM clients WHERE id = $1", request.client_id)
        if client:
            context_data["client"] = dict(client)

            # Get client history
            recent_jobs = await db.fetch("""
                SELECT job_type, status, COUNT(*) as count
                FROM automation_jobs
                WHERE client_id = $1 AND created_at > NOW() - INTERVAL '30 days'
                GROUP BY job_type, status
            """, request.client_id)
            context_data["recent_job_history"] = [dict(r) for r in recent_jobs]

    # Decision logic based on context type
    decision_context = request.context.lower()

    if "scheduling" in decision_context or "when" in decision_context:
        return await _make_scheduling_decision(request, context_data, db)

    elif "prioritization" in decision_context or "priority" in decision_context:
        return await _make_prioritization_decision(request, context_data, db)

    elif "automation" in decision_context or "automate" in decision_context:
        return await _make_automation_decision(request, context_data, db)

    else:
        # Generic decision
        return DecisionResponse(
            decision="Requires manual review",
            confidence=0.3,
            reasoning="The context provided doesn't match known decision patterns. Manual review recommended.",
            alternatives=[],
            risk_factors=["Insufficient context for automated decision"],
            recommended_actions=["Provide more specific context", "Consult with team"]
        )


@router.get("/schedule/recommendations", response_model=List[JobScheduleRecommendation])
async def get_schedule_recommendations(
    client_id: Optional[uuid.UUID] = None,
    job_type: Optional[str] = None,
    hours_ahead: int = Query(24, ge=1, le=168),
    db=Depends(get_db)
):
    """Get intelligent job scheduling recommendations."""
    recommendations = []
    now = datetime.utcnow()
    end_time = now + timedelta(hours=hours_ahead)

    # Get clients to schedule for
    if client_id:
        clients = await db.fetch("SELECT id, name FROM clients WHERE id = $1", client_id)
    else:
        clients = await db.fetch("SELECT id, name FROM clients WHERE portal_enabled = TRUE LIMIT 50")

    for client in clients:
        # Analyze optimal scheduling windows
        # Avoid times with high job volume
        busy_periods = await db.fetch("""
            SELECT
                date_trunc('hour', scheduled_at) as hour,
                COUNT(*) as job_count
            FROM automation_jobs
            WHERE scheduled_at BETWEEN $1 AND $2
            GROUP BY date_trunc('hour', scheduled_at)
            HAVING COUNT(*) > 3
        """, now, end_time)

        busy_hours = {row["hour"] for row in busy_periods}

        # Get last job times for this client
        last_jobs = await db.fetch("""
            SELECT job_type, MAX(completed_at) as last_run
            FROM automation_jobs
            WHERE client_id = $1 AND status = 'completed'
            GROUP BY job_type
        """, client["id"])

        last_job_times = {row["job_type"]: row["last_run"] for row in last_jobs}

        # Generate recommendations for common job types
        job_types_to_schedule = ["health_check", "menu_sync", "golden_copy"]
        if job_type:
            job_types_to_schedule = [job_type]

        for jt in job_types_to_schedule:
            # Determine optimal time
            last_run = last_job_times.get(jt)

            # Calculate recommended interval based on job type
            intervals = {
                "health_check": timedelta(hours=6),
                "menu_sync": timedelta(hours=24),
                "golden_copy": timedelta(hours=24),
                "backup": timedelta(hours=12)
            }

            interval = intervals.get(jt, timedelta(hours=24))

            if last_run:
                next_run = last_run + interval
                if next_run < now:
                    next_run = now + timedelta(minutes=30)
            else:
                next_run = now + timedelta(hours=1)

            # Adjust to avoid busy periods
            while next_run.replace(minute=0, second=0) in busy_hours:
                next_run += timedelta(hours=1)

            # Calculate conflict score
            conflict_score = len([b for b in busy_hours if abs((b - next_run).total_seconds()) < 3600]) / max(len(busy_hours), 1)

            recommendations.append(JobScheduleRecommendation(
                job_type=jt,
                client_id=client["id"],
                recommended_time=next_run,
                reason=f"Optimal window based on historical patterns and current queue load",
                priority=2 if last_run and (now - last_run) > interval * 1.5 else 1,
                conflict_score=conflict_score
            ))

    # Sort by priority and conflict score
    recommendations.sort(key=lambda x: (-x.priority, x.conflict_score))

    return recommendations


# ============================================
# HELPER FUNCTIONS
# ============================================

async def _calculate_health_factors(db, client_id: uuid.UUID) -> Dict[str, int]:
    """Calculate individual health factors for a client."""
    factors = {}

    # Engagement factor (based on recent activity)
    activity_count = await db.fetchval("""
        SELECT COUNT(*) FROM activity_log
        WHERE client_id = $1 AND created_at > NOW() - INTERVAL '30 days'
    """, client_id)
    factors["engagement"] = min(100, int(activity_count * 5))

    # Automation success factor
    job_stats = await db.fetchrow("""
        SELECT
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) as total
        FROM automation_jobs
        WHERE client_id = $1 AND created_at > NOW() - INTERVAL '30 days'
    """, client_id)

    if job_stats["total"] > 0:
        factors["automation_success"] = int((job_stats["completed"] / job_stats["total"]) * 100)
    else:
        factors["automation_success"] = 50  # Neutral if no jobs

    # Support responsiveness (based on ticket response times)
    avg_response = await db.fetchval("""
        SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))) / 3600
        FROM tickets
        WHERE client_id = $1 AND first_response_at IS NOT NULL
    """, client_id)

    if avg_response:
        # Target: < 4 hours = 100, > 24 hours = 0
        factors["support_responsiveness"] = max(0, min(100, int(100 - (avg_response - 4) * 5)))
    else:
        factors["support_responsiveness"] = 50

    # Payment health
    payment_status = await db.fetchval("""
        SELECT support_plan_status FROM clients WHERE id = $1
    """, client_id)
    factors["payment_health"] = 100 if payment_status == "active" else 50 if payment_status == "pending" else 0

    # System stability (based on error rates)
    error_count = await db.fetchval("""
        SELECT COUNT(*) FROM automation_jobs
        WHERE client_id = $1 AND status = 'failed' AND created_at > NOW() - INTERVAL '7 days'
    """, client_id)
    factors["system_stability"] = max(0, 100 - (error_count * 10))

    # Growth potential (based on restaurant count and activity trends)
    restaurant_count = await db.fetchval("""
        SELECT COUNT(*) FROM restaurants WHERE client_id = $1
    """, client_id)
    factors["growth_potential"] = min(100, restaurant_count * 20 + 40)

    return factors


async def _calculate_health_trend(db, client_id: uuid.UUID) -> str:
    """Calculate health trend over time."""
    # Compare last 30 days to previous 30 days
    recent = await db.fetchval("""
        SELECT COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0)
        FROM automation_jobs
        WHERE client_id = $1 AND created_at > NOW() - INTERVAL '30 days'
    """, client_id)

    previous = await db.fetchval("""
        SELECT COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0)
        FROM automation_jobs
        WHERE client_id = $1
          AND created_at > NOW() - INTERVAL '60 days'
          AND created_at <= NOW() - INTERVAL '30 days'
    """, client_id)

    if recent is None or previous is None:
        return "stable"

    diff = (recent or 0) - (previous or 0)
    if diff > 5:
        return "improving"
    elif diff < -5:
        return "declining"
    return "stable"


async def _generate_client_recommendations(db, client_id: uuid.UUID, factors: Dict[str, int]) -> List[Dict[str, Any]]:
    """Generate recommendations based on health factors."""
    recommendations = []

    if factors.get("engagement", 0) < 50:
        recommendations.append({
            "type": "engagement",
            "title": "Schedule a check-in call",
            "description": "Low engagement detected. Consider reaching out to understand their needs.",
            "priority": "high"
        })

    if factors.get("automation_success", 0) < 70:
        recommendations.append({
            "type": "optimization",
            "title": "Review failed automations",
            "description": "Automation success rate is below target. Review and fix failing jobs.",
            "priority": "medium"
        })

    if factors.get("system_stability", 0) < 80:
        recommendations.append({
            "type": "maintenance",
            "title": "System stability audit",
            "description": "Higher than normal error rates detected. Conduct stability review.",
            "priority": "high"
        })

    if factors.get("growth_potential", 0) > 80:
        recommendations.append({
            "type": "upsell",
            "title": "Upsell opportunity",
            "description": "Client shows strong growth indicators. Consider expanding services.",
            "priority": "low"
        })

    return recommendations


async def _gather_system_metrics(db) -> Dict[str, Any]:
    """Gather system-wide metrics."""
    metrics = {}

    # Job metrics
    job_metrics = await db.fetchrow("""
        SELECT
            COUNT(*) as total_jobs_24h,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_24h,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_24h,
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE completed_at IS NOT NULL) as avg_duration
        FROM automation_jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
    """)
    metrics["jobs_24h"] = dict(job_metrics)

    # Client metrics
    client_metrics = await db.fetchrow("""
        SELECT
            COUNT(*) as total_clients,
            COUNT(*) FILTER (WHERE support_plan_status = 'active') as active_plans,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_this_month
        FROM clients
    """)
    metrics["clients"] = dict(client_metrics)

    return metrics


async def _make_scheduling_decision(request: DecisionRequest, context_data: dict, db) -> DecisionResponse:
    """Make a scheduling-related decision."""
    # Analyze scheduling constraints
    constraints = request.constraints
    preferred_times = constraints.get("preferred_times", [])
    avoid_times = constraints.get("avoid_times", [])

    # Get current queue load
    queue_load = await db.fetch("""
        SELECT
            date_trunc('hour', scheduled_at) as hour,
            COUNT(*) as count
        FROM automation_jobs
        WHERE scheduled_at > NOW() AND scheduled_at < NOW() + INTERVAL '24 hours'
        GROUP BY date_trunc('hour', scheduled_at)
    """)

    # Find optimal slot
    now = datetime.utcnow()
    best_slot = now + timedelta(hours=1)
    min_load = float('inf')

    for hour_offset in range(24):
        slot = now.replace(minute=0, second=0) + timedelta(hours=hour_offset)
        slot_load = next((r["count"] for r in queue_load if r["hour"] == slot), 0)

        if slot_load < min_load:
            min_load = slot_load
            best_slot = slot

    return DecisionResponse(
        decision=f"Schedule for {best_slot.strftime('%Y-%m-%d %H:%M')} UTC",
        confidence=0.85,
        reasoning=f"Selected time slot has lowest queue load ({min_load} jobs). Avoids peak hours.",
        alternatives=[
            {"time": (best_slot + timedelta(hours=2)).isoformat(), "load": min_load + 1},
            {"time": (best_slot + timedelta(hours=4)).isoformat(), "load": min_load + 2}
        ],
        risk_factors=[
            "Time zone differences may affect optimal execution",
            "Toast system maintenance windows not accounted for"
        ],
        recommended_actions=[
            "Verify client timezone preferences",
            "Check Toast status page for maintenance windows"
        ]
    )


async def _make_prioritization_decision(request: DecisionRequest, context_data: dict, db) -> DecisionResponse:
    """Make a prioritization decision."""
    options = request.options

    if not options:
        return DecisionResponse(
            decision="Unable to prioritize without options",
            confidence=0.0,
            reasoning="No options provided for prioritization",
            alternatives=[],
            risk_factors=["No data to analyze"],
            recommended_actions=["Provide options to prioritize"]
        )

    # Score each option
    scored_options = []
    for opt in options:
        score = 0
        score += opt.get("urgency", 0) * 30
        score += opt.get("impact", 0) * 25
        score += opt.get("effort_inverse", 10 - opt.get("effort", 5)) * 20
        score += opt.get("client_value", 0) * 25
        scored_options.append({"option": opt, "score": score})

    scored_options.sort(key=lambda x: x["score"], reverse=True)
    winner = scored_options[0]

    return DecisionResponse(
        decision=f"Prioritize: {winner['option'].get('name', 'Option 1')}",
        confidence=0.75,
        reasoning=f"Highest weighted score ({winner['score']}) based on urgency, impact, effort, and client value",
        alternatives=[{"option": s["option"].get("name"), "score": s["score"]} for s in scored_options[1:3]],
        risk_factors=[
            "Scoring weights may not reflect current business priorities",
            "External factors not considered"
        ],
        recommended_actions=[
            "Review prioritization with team if uncertain",
            "Consider deadline constraints"
        ]
    )


async def _make_automation_decision(request: DecisionRequest, context_data: dict, db) -> DecisionResponse:
    """Decide whether to automate a task."""
    # Analyze if automation is worthwhile
    constraints = request.constraints
    frequency = constraints.get("frequency_per_month", 1)
    manual_time_minutes = constraints.get("manual_time_minutes", 30)
    automation_effort_hours = constraints.get("automation_effort_hours", 8)

    # Calculate ROI
    monthly_time_saved = frequency * manual_time_minutes / 60  # hours
    payback_months = automation_effort_hours / monthly_time_saved if monthly_time_saved > 0 else float('inf')

    should_automate = payback_months <= 3  # 3-month payback threshold

    return DecisionResponse(
        decision="Automate" if should_automate else "Keep Manual",
        confidence=0.80 if payback_months <= 2 or payback_months > 6 else 0.60,
        reasoning=f"Payback period: {payback_months:.1f} months. {'Good ROI within 3 months.' if should_automate else 'ROI too long to justify automation effort.'}",
        alternatives=[
            {"decision": "Partial automation", "description": "Automate repetitive subtasks only"},
            {"decision": "Template-based", "description": "Use templates instead of full automation"}
        ],
        risk_factors=[
            "Actual automation time may exceed estimates",
            "Task requirements may change",
            "Maintenance overhead not included"
        ],
        recommended_actions=[
            "Start with a prototype" if should_automate else "Document manual process",
            "Track actual time savings after implementation"
        ]
    )


def _row_to_recommendation(row: dict) -> Recommendation:
    """Convert database row to Recommendation model."""
    return Recommendation(
        id=row["id"],
        client_id=row["client_id"],
        recommendation_type=RecommendationType(row["recommendation_type"]),
        title=row["title"],
        description=row["description"],
        impact_score=row["impact_score"],
        effort_score=row["effort_score"],
        priority=row["priority"],
        action_items=json.loads(row["action_items"]) if isinstance(row["action_items"], str) else row["action_items"] or [],
        estimated_value=row.get("estimated_value"),
        status=row["status"],
        metadata=json.loads(row["metadata"]) if row.get("metadata") and isinstance(row["metadata"], str) else row.get("metadata") or {},
        created_at=row["created_at"],
        expires_at=row.get("expires_at")
    )
