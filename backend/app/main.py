"""FastAPI routes, incident workflow, and Prometheus instrumentation."""

from datetime import datetime, timezone
from time import perf_counter

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.database import get_db
from app.models import Incident
from app.schemas import (
    IncidentCreate,
    IncidentOut,
    IncidentSummary,
    IncidentUpdate,
    Severity,
    Status,
)


app = FastAPI(title="SignalDesk Incident API", version="0.1.0")

REQUESTS = Counter(
    "incident_http_requests_total",
    "HTTP requests handled by the incident API",
    ["method", "route", "status_code"],
)
LATENCY = Histogram(
    "incident_http_request_duration_seconds",
    "Incident API request duration in seconds",
    ["method", "route"],
)
CREATED = Counter("incident_created_total", "Incidents created")
TRANSITIONS = Counter(
    "incident_status_transitions_total",
    "Incident workflow transitions",
    ["from_status", "to_status"],
)

ALLOWED_TRANSITIONS: dict[Status, set[Status]] = {
    Status.OPEN: {Status.INVESTIGATING},
    Status.INVESTIGATING: {Status.MITIGATED, Status.RESOLVED},
    Status.MITIGATED: {Status.INVESTIGATING, Status.RESOLVED},
    Status.RESOLVED: {Status.INVESTIGATING},
}


@app.middleware("http")
async def track_requests(request: Request, call_next):
    started = perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        if request.url.path != "/metrics":
            route = request.scope.get("route")
            route_name = route.path if route else "unmatched"
            REQUESTS.labels(request.method, route_name, str(status_code)).inc()
            LATENCY.labels(request.method, route_name).observe(perf_counter() - started)


@app.get("/health")
def health():
    return {"status": "alive"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="database unavailable") from None
    return {"status": "ready"}


@app.get("/metrics", include_in_schema=False)
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/api/incidents", response_model=list[IncidentOut])
def list_incidents(
    status_filter: Status | None = Query(default=None, alias="status"),
    severity: Severity | None = None,
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    statement = select(Incident)
    if status_filter is not None:
        statement = statement.where(Incident.status == status_filter.value)
    if severity is not None:
        statement = statement.where(Incident.severity == severity.value)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                Incident.title.ilike(pattern),
                Incident.service.ilike(pattern),
                Incident.description.ilike(pattern),
            )
        )
    statement = statement.order_by(Incident.updated_at.desc(), Incident.id.desc())
    return db.scalars(statement.limit(limit).offset(offset)).all()


@app.get("/api/incidents/summary", response_model=IncidentSummary)
def incident_summary(db: Session = Depends(get_db)):
    status_counts = dict(
        db.execute(select(Incident.status, func.count()).group_by(Incident.status)).all()
    )
    severity_counts = dict(
        db.execute(select(Incident.severity, func.count()).group_by(Incident.severity)).all()
    )
    return IncidentSummary(
        total=sum(status_counts.values()),
        by_status={item: status_counts.get(item.value, 0) for item in Status},
        by_severity={item: severity_counts.get(item.value, 0) for item in Severity},
    )


@app.get("/api/incidents/{incident_id}", response_model=IncidentOut)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    return incident


@app.post("/api/incidents", response_model=IncidentOut, status_code=status.HTTP_201_CREATED)
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    incident = Incident(**payload.model_dump(), status=Status.OPEN.value)
    db.add(incident)
    db.commit()
    db.refresh(incident)
    CREATED.inc()
    return incident


@app.put("/api/incidents/{incident_id}", response_model=IncidentOut)
def update_incident(incident_id: int, payload: IncidentUpdate, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")

    previous = Status(incident.status)
    if payload.status != previous and payload.status not in ALLOWED_TRANSITIONS[previous]:
        raise HTTPException(
            status_code=409,
            detail=f"cannot move incident from {previous.value} to {payload.status.value}",
        )

    for field, value in payload.model_dump().items():
        setattr(incident, field, value)
    incident.updated_at = datetime.now(timezone.utc)
    if payload.status == Status.RESOLVED and previous != Status.RESOLVED:
        incident.resolved_at = incident.updated_at
    elif previous == Status.RESOLVED and payload.status != Status.RESOLVED:
        incident.resolved_at = None

    db.commit()
    db.refresh(incident)
    if payload.status != previous:
        TRANSITIONS.labels(previous.value, payload.status.value).inc()
    return incident


@app.delete("/api/incidents/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    db.delete(incident)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
