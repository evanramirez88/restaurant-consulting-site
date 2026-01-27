"""
Phase 5: QA Center of Excellence
QA Router - API endpoints for test execution and monitoring
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import asyncio
import json
import uuid

router = APIRouter(prefix="/qa", tags=["qa"])


# ============== Models ==============

class TestStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"


class RunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TestRunConfig(BaseModel):
    suites: Optional[List[str]] = Field(None, description="Specific suites to run")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    parallel: bool = Field(False, description="Run suites in parallel")
    fail_fast: bool = Field(False, description="Stop on first failure")
    timeout: int = Field(60000, description="Test timeout in ms")
    headless: bool = Field(True, description="Run browser in headless mode")
    base_url: Optional[str] = Field(None, description="Override base URL")
    credentials: Optional[Dict[str, str]] = Field(None, description="Test credentials")


class TestRunResponse(BaseModel):
    run_id: str
    status: RunStatus
    created_at: datetime
    suites_queued: int


class SelectorCheckRequest(BaseModel):
    url: str
    selectors: List[Dict[str, Any]]
    timeout: int = Field(5000)


class VisualCompareRequest(BaseModel):
    baseline_name: str
    current_screenshot: str  # Base64 encoded
    threshold: float = Field(0.1)
    ignore_regions: Optional[List[Dict[str, int]]] = None


class BaselineRequest(BaseModel):
    name: str
    screenshot: str  # Base64 encoded
    metadata: Optional[Dict[str, Any]] = None


# ============== In-Memory Storage ==============

test_runs: Dict[str, Dict] = {}
test_results: Dict[str, List[Dict]] = {}
baselines: Dict[str, Dict] = {}
selector_configs: Dict[str, List[Dict]] = {}
performance_metrics: Dict[str, List[Dict]] = {}
active_websockets: Dict[str, List[WebSocket]] = {}


# ============== Test Execution ==============

@router.post("/runs", response_model=TestRunResponse)
async def create_test_run(config: TestRunConfig, background_tasks: BackgroundTasks):
    """Create and queue a new test run"""
    run_id = f"run-{uuid.uuid4().hex[:12]}"

    # Get available suites
    available_suites = ["Toast Login Suite", "Toast Menu Suite"]
    suites_to_run = config.suites if config.suites else available_suites

    if config.tags:
        # Filter by tags (would need actual suite metadata)
        pass

    test_runs[run_id] = {
        "id": run_id,
        "status": RunStatus.QUEUED,
        "config": config.dict(),
        "created_at": datetime.utcnow(),
        "started_at": None,
        "completed_at": None,
        "suites": suites_to_run,
        "results": None,
        "stats": None
    }

    # Execute in background
    background_tasks.add_task(execute_test_run, run_id, config)

    return TestRunResponse(
        run_id=run_id,
        status=RunStatus.QUEUED,
        created_at=test_runs[run_id]["created_at"],
        suites_queued=len(suites_to_run)
    )


async def execute_test_run(run_id: str, config: TestRunConfig):
    """Background task to execute test run"""
    run = test_runs.get(run_id)
    if not run:
        return

    run["status"] = RunStatus.RUNNING
    run["started_at"] = datetime.utcnow()

    # Notify websocket clients
    await broadcast_run_update(run_id, {"status": "running", "started_at": run["started_at"].isoformat()})

    try:
        # Simulate test execution (would integrate with actual test runner)
        results = {
            "suites": [],
            "stats": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "skipped": 0
            }
        }

        for suite_name in run["suites"]:
            suite_result = await execute_suite(suite_name, config)
            results["suites"].append(suite_result)
            results["stats"]["total"] += suite_result["total"]
            results["stats"]["passed"] += suite_result["passed"]
            results["stats"]["failed"] += suite_result["failed"]
            results["stats"]["skipped"] += suite_result["skipped"]

            # Notify progress
            await broadcast_run_update(run_id, {
                "status": "running",
                "suite_completed": suite_name,
                "progress": len(results["suites"]) / len(run["suites"])
            })

            if config.fail_fast and suite_result["failed"] > 0:
                break

        run["status"] = RunStatus.COMPLETED if results["stats"]["failed"] == 0 else RunStatus.FAILED
        run["results"] = results
        run["stats"] = results["stats"]

    except Exception as e:
        run["status"] = RunStatus.FAILED
        run["error"] = str(e)

    run["completed_at"] = datetime.utcnow()

    await broadcast_run_update(run_id, {
        "status": run["status"],
        "completed_at": run["completed_at"].isoformat(),
        "stats": run.get("stats")
    })


async def execute_suite(suite_name: str, config: TestRunConfig) -> Dict:
    """Execute a single test suite (placeholder - would call actual test runner)"""
    # This would integrate with the JavaScript test runner
    # For now, return mock data
    await asyncio.sleep(1)  # Simulate execution time

    return {
        "name": suite_name,
        "status": "passed",
        "total": 8,
        "passed": 7,
        "failed": 0,
        "skipped": 1,
        "duration": 5432,
        "tests": [
            {"name": "Login page loads correctly", "status": "passed", "duration": 1234},
            {"name": "Invalid credentials show error", "status": "passed", "duration": 2345},
        ]
    }


@router.get("/runs")
async def list_test_runs(
    status: Optional[RunStatus] = None,
    limit: int = 20,
    offset: int = 0
):
    """List all test runs"""
    runs = list(test_runs.values())

    if status:
        runs = [r for r in runs if r["status"] == status]

    runs.sort(key=lambda x: x["created_at"], reverse=True)

    return {
        "total": len(runs),
        "runs": runs[offset:offset + limit]
    }


@router.get("/runs/{run_id}")
async def get_test_run(run_id: str):
    """Get details of a specific test run"""
    run = test_runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return run


@router.post("/runs/{run_id}/cancel")
async def cancel_test_run(run_id: str):
    """Cancel a running test"""
    run = test_runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")

    if run["status"] not in [RunStatus.QUEUED, RunStatus.RUNNING]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed run")

    run["status"] = RunStatus.CANCELLED
    run["completed_at"] = datetime.utcnow()

    return {"status": "cancelled", "run_id": run_id}


# ============== Selector Health ==============

@router.post("/selectors/check")
async def check_selectors(request: SelectorCheckRequest):
    """Check selector health against a URL"""
    # This would integrate with browser-service
    results = []

    for selector in request.selectors:
        results.append({
            "id": selector.get("id"),
            "selector": selector.get("selector"),
            "found": True,  # Placeholder
            "duration": 125,
            "status": "healthy"
        })

    return {
        "url": request.url,
        "total": len(results),
        "passed": sum(1 for r in results if r["found"]),
        "failed": sum(1 for r in results if not r["found"]),
        "results": results
    }


@router.get("/selectors/health")
async def get_selector_health():
    """Get overall selector health report"""
    # Aggregate selector health data
    return {
        "timestamp": datetime.utcnow(),
        "summary": {
            "total": 25,
            "healthy": 22,
            "warning": 2,
            "critical": 1
        },
        "critical_selectors": [
            {
                "id": "menu-item-row",
                "selector": ".menu-item-row",
                "status": "critical",
                "failure_rate": "35%",
                "last_checked": datetime.utcnow()
            }
        ]
    }


@router.post("/selectors/register")
async def register_selectors(selectors: List[Dict[str, Any]]):
    """Register selectors for monitoring"""
    registered = []

    for selector in selectors:
        selector_id = selector.get("id") or f"sel-{uuid.uuid4().hex[:8]}"
        selector_configs[selector_id] = {
            "id": selector_id,
            "selector": selector["selector"],
            "type": selector.get("type", "css"),
            "description": selector.get("description"),
            "critical": selector.get("critical", False),
            "alternatives": selector.get("alternatives", []),
            "registered_at": datetime.utcnow()
        }
        registered.append(selector_id)

    return {"registered": registered, "count": len(registered)}


# ============== Visual Regression ==============

@router.post("/visual/baselines")
async def create_baseline(request: BaselineRequest):
    """Store a visual baseline"""
    baselines[request.name] = {
        "name": request.name,
        "screenshot": request.screenshot,
        "metadata": request.metadata or {},
        "created_at": datetime.utcnow(),
        "version": baselines.get(request.name, {}).get("version", 0) + 1
    }

    return {
        "name": request.name,
        "version": baselines[request.name]["version"],
        "created_at": baselines[request.name]["created_at"]
    }


@router.get("/visual/baselines")
async def list_baselines():
    """List all visual baselines"""
    return {
        "baselines": [
            {
                "name": b["name"],
                "version": b["version"],
                "created_at": b["created_at"],
                "has_metadata": bool(b["metadata"])
            }
            for b in baselines.values()
        ]
    }


@router.post("/visual/compare")
async def compare_visual(request: VisualCompareRequest):
    """Compare screenshot against baseline"""
    baseline = baselines.get(request.baseline_name)
    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline not found")

    # This would integrate with visual diff engine
    # Placeholder response
    return {
        "baseline_name": request.baseline_name,
        "baseline_version": baseline["version"],
        "match": True,
        "diff_percent": 0.5,
        "threshold": request.threshold * 100,
        "status": "passed",
        "diff_image": None  # Would contain base64 diff image
    }


# ============== Performance ==============

@router.get("/performance/metrics")
async def get_performance_metrics(
    operation: Optional[str] = None,
    since: Optional[datetime] = None
):
    """Get performance metrics"""
    metrics = []

    for op_name, op_metrics in performance_metrics.items():
        if operation and op_name != operation:
            continue

        filtered = op_metrics
        if since:
            filtered = [m for m in op_metrics if m["timestamp"] >= since]

        if filtered:
            durations = [m["duration"] for m in filtered]
            metrics.append({
                "operation": op_name,
                "count": len(filtered),
                "mean": sum(durations) / len(durations),
                "min": min(durations),
                "max": max(durations),
                "p95": sorted(durations)[int(len(durations) * 0.95)] if durations else 0
            })

    return {"metrics": metrics}


@router.post("/performance/record")
async def record_performance(
    operation: str,
    duration: float,
    metadata: Optional[Dict[str, Any]] = None
):
    """Record a performance metric"""
    if operation not in performance_metrics:
        performance_metrics[operation] = []

    performance_metrics[operation].append({
        "duration": duration,
        "timestamp": datetime.utcnow(),
        "metadata": metadata or {}
    })

    # Maintain history size
    if len(performance_metrics[operation]) > 1000:
        performance_metrics[operation] = performance_metrics[operation][-500:]

    return {"recorded": True, "operation": operation, "duration": duration}


@router.get("/performance/report")
async def get_performance_report():
    """Get comprehensive performance report"""
    report = {
        "generated_at": datetime.utcnow(),
        "operations": {}
    }

    for op_name, op_metrics in performance_metrics.items():
        if not op_metrics:
            continue

        durations = [m["duration"] for m in op_metrics]
        sorted_durations = sorted(durations)

        report["operations"][op_name] = {
            "count": len(durations),
            "mean": sum(durations) / len(durations),
            "median": sorted_durations[len(sorted_durations) // 2],
            "p95": sorted_durations[int(len(sorted_durations) * 0.95)],
            "min": min(durations),
            "max": max(durations)
        }

    return report


# ============== Reports ==============

@router.get("/reports/summary")
async def get_qa_summary():
    """Get overall QA summary"""
    recent_runs = sorted(
        test_runs.values(),
        key=lambda x: x["created_at"],
        reverse=True
    )[:10]

    passed = sum(1 for r in recent_runs if r["status"] == RunStatus.COMPLETED)
    failed = sum(1 for r in recent_runs if r["status"] == RunStatus.FAILED)

    return {
        "timestamp": datetime.utcnow(),
        "test_runs": {
            "total": len(test_runs),
            "recent_passed": passed,
            "recent_failed": failed,
            "pass_rate": f"{(passed / len(recent_runs) * 100):.1f}%" if recent_runs else "N/A"
        },
        "selectors": {
            "total": len(selector_configs),
            "healthy": sum(1 for s in selector_configs.values() if s.get("status") == "healthy"),
            "critical": sum(1 for s in selector_configs.values() if s.get("critical"))
        },
        "baselines": {
            "total": len(baselines)
        },
        "last_run": recent_runs[0] if recent_runs else None
    }


# ============== WebSocket for Real-Time Updates ==============

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket for real-time test updates"""
    await websocket.accept()

    if client_id not in active_websockets:
        active_websockets[client_id] = []
    active_websockets[client_id].append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "subscribe":
                run_id = message.get("run_id")
                if run_id:
                    # Store subscription (simplified)
                    pass

            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        active_websockets[client_id].remove(websocket)
        if not active_websockets[client_id]:
            del active_websockets[client_id]


async def broadcast_run_update(run_id: str, update: Dict):
    """Broadcast test run update to all connected clients"""
    message = json.dumps({"type": "run_update", "run_id": run_id, **update})

    for client_id, sockets in active_websockets.items():
        for socket in sockets:
            try:
                await socket.send_text(message)
            except:
                pass
