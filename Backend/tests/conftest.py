"""
ZeroSec Test Configuration & Shared Fixtures
=============================================
Provides a self-contained Flask test application backed by SQLite in-memory.
All API test modules import fixtures from here.

Run the full suite:
    pytest backend/tests/ -v

Run a single module:
    pytest backend/tests/test_auth.py -v

Run with coverage:
    pytest backend/tests/ --cov=backend --cov-report=term-missing
"""
from __future__ import annotations

import io
import os
import tempfile
from datetime import datetime, timezone

import pytest

# Force test environment before any app-level import
os.environ.setdefault("FLASK_ENV", "testing")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-for-pytest-only")
os.environ.setdefault("SAG_HMAC_SALT", "test-hmac-salt")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def app():
    """
    Session-scoped Flask application using an isolated SQLite database.
    Blueprints are registered exactly as in production; the only difference
    is DATABASE_URI points to an in-memory SQLite file.
    """
    from backend.app import app as flask_app

    flask_app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        JWT_SECRET_KEY="test-jwt-secret-for-pytest-only",
        SECRET_KEY="test-secret-key-for-pytest-only",
        SAG_HMAC_SALT="test-hmac-salt",
        WTF_CSRF_ENABLED=False,
    )

    # Recreate DB tables in the in-memory SQLite instance
    from backend.database.db import db
    with flask_app.app_context():
        db.create_all()

    yield flask_app

    with flask_app.app_context():
        db.drop_all()


@pytest.fixture(scope="session")
def client(app):
    """Session-scoped test HTTP client."""
    return app.test_client()


@pytest.fixture(scope="session")
def db_session(app):
    """Direct SQLAlchemy session for setup helpers."""
    from backend.database.db import db
    with app.app_context():
        yield db.session


# ---------------------------------------------------------------------------
# Seed data helpers
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def seed_org(app):
    """Create a test organisation and return its ID."""
    from backend.database.db import db
    from backend.database.models import Organization, Department

    with app.app_context():
        org = Organization(name="TestOrg", created_at=datetime.now(timezone.utc))
        db.session.add(org)
        db.session.flush()

        dept = Department(
            organization_id=org.organization_id,
            name="General",
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(dept)
        db.session.commit()
        return org.organization_id


@pytest.fixture(scope="session")
def seed_admin(app, seed_org):
    """Register an Admin user and return (user_id, token)."""
    client = app.test_client()
    resp = client.post("/api/auth/register", json={
        "username":          "test_admin",
        "email":             "admin@testorg.local",
        "password":          "Admin@12345",
        "organization_name": "TestOrg",
    })
    assert resp.status_code in (200, 201, 409), f"Admin register failed: {resp.data}"

    login = client.post("/api/auth/login", json={
        "username": "test_admin",
        "password": "Admin@12345",
    })
    data = login.get_json()
    token = data.get("access_token", "")
    user_id = data.get("user_id", 1)
    return user_id, token


@pytest.fixture(scope="session")
def seed_viewer(app, seed_org):
    """Register a Viewer (non-admin) user and return (user_id, token)."""
    client = app.test_client()
    resp = client.post("/api/auth/register", json={
        "username":          "test_viewer",
        "email":             "viewer@testorg.local",
        "password":          "Viewer@12345",
        "organization_name": "TestOrg",
    })
    assert resp.status_code in (200, 201, 409), f"Viewer register failed: {resp.data}"

    login = client.post("/api/auth/login", json={
        "username": "test_viewer",
        "password": "Viewer@12345",
    })
    data = login.get_json()
    token = data.get("access_token", "")
    user_id = data.get("user_id", 2)
    return user_id, token


# ---------------------------------------------------------------------------
# Reusable header builders
# ---------------------------------------------------------------------------

def auth_header(token: str) -> dict:
    """Return Authorization header dict for a JWT token."""
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# File factory helpers
# ---------------------------------------------------------------------------

def make_txt_file(content: str, filename: str = "test.txt") -> tuple:
    """Return (BytesIO, filename) suitable for a multipart upload."""
    return io.BytesIO(content.encode()), filename


def make_pdf_bytes(text: str) -> bytes:
    """
    Minimal valid PDF containing the given text.
    Good enough for content-scanning tests without requiring pdfplumber.
    """
    escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type /Pages /Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type /Page /Parent 2 0 R /MediaBox[0 0 612 792]"
        b" /Contents 4 0 R /Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
        + f"4 0 obj<</Length {len(text)+30}>>\nstream\nBT /F1 12 Tf 72 720 Td ({escaped}) Tj ET\nendstream\nendobj\n".encode()
        + b"5 0 obj<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>endobj\n"
        b"xref\n0 6\ntrailer<</Size 6 /Root 1 0 R>>\nstartxref\n0\n%%EOF\n"
    )
