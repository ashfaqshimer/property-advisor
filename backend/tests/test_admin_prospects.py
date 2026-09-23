from datetime import datetime, timezone, timedelta
from typing import Generator
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.scan_job import ScanJob


def test_admin_prospects_requires_authentication(client: TestClient) -> None:
    assert client.get("/admin/prospects").status_code == 401
    assert client.get("/admin/prospects/scan/active").status_code == 401


def test_get_prospects_empty(authenticated_client: TestClient) -> None:
    response = authenticated_client.get("/admin/prospects")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) == 0
    assert data["total"] == 0


def test_get_active_jobs_empty(authenticated_client: TestClient) -> None:
    response = authenticated_client.get("/admin/prospects/scan/active")
    assert response.status_code == 200
    data = response.json()
    assert data["scan"] is None
    assert data["phone_fetch"] is None
    assert data["last_scan_at"] is None
    assert data["last_phone_fetch_at"] is None


def test_get_active_jobs_stuck_job_timeout(authenticated_client: TestClient, db_session: Session) -> None:
    # Create a stuck running job created 2 hours ago
    stuck_time = datetime.now(timezone.utc) - timedelta(hours=2)
    job_id = uuid.uuid4()
    stuck_job = ScanJob(
        id=job_id,
        job_type="scan",
        status="running",
        progress="Starting up...",
        created_at=stuck_time,
        updated_at=stuck_time,
        created_by_name="root"
    )
    db_session.add(stuck_job)
    db_session.commit()

    # Call the endpoint
    response = authenticated_client.get("/admin/prospects/scan/active")
    assert response.status_code == 200
    data = response.json()

    # Job should be failed and NOT returned as active
    assert data["scan"] is None
    
    # Verify in DB it was marked as failed
    db_session.refresh(stuck_job)
    assert stuck_job.status == "failed"
    assert "Job timed out" in str(stuck_job.error)


def test_get_active_jobs_returns_root_info(authenticated_client: TestClient, db_session: Session) -> None:
    # Create a completed scan job
    job_id = uuid.uuid4()
    recent_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    completed_job = ScanJob(
        id=job_id,
        job_type="scan",
        status="completed",
        progress="Done",
        created_at=recent_time,
        updated_at=recent_time,
        created_by_name="root user"
    )
    db_session.add(completed_job)
    db_session.commit()

    response = authenticated_client.get("/admin/prospects/scan/active")
    assert response.status_code == 200
    data = response.json()
    
    assert data["last_scan_at"] is not None
    assert data["last_scan_by"] == "root user"
