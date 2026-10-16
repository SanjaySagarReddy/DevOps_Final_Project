"""Validated API input and output."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class Severity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Status(StrEnum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    MITIGATED = "mitigated"
    RESOLVED = "resolved"


class IncidentFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=3, max_length=160)
    service: str = Field(min_length=2, max_length=100)
    severity: Severity
    owner: str = Field(min_length=2, max_length=100)
    description: str = Field(min_length=10, max_length=5000)


class IncidentCreate(IncidentFields):
    pass


class IncidentUpdate(IncidentFields):
    status: Status


class IncidentOut(IncidentFields):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: Status
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class IncidentSummary(BaseModel):
    total: int
    by_status: dict[Status, int]
    by_severity: dict[Severity, int]
