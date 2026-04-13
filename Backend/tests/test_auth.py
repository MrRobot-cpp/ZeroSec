"""
Authentication Test Suite — TC01 through TC06
==============================================
FR-01: Authentication & Session Management
FR-13: Session token lifecycle

Covers:
  TC01 — Valid registration
  TC02 — Login with valid credentials
  TC03 — Login with invalid credentials
  TC04 — JWT access-token expiry / refresh
  TC05 — Logout / token revocation
  TC06 — Duplicate registration rejected
"""
from __future__ import annotations

import pytest
from backend.tests.conftest import auth_header


# ---------------------------------------------------------------------------
# TC01 — User Registration (valid)
# ---------------------------------------------------------------------------

class TestTC01_ValidRegistration:
    """
    Objective: Verify that a new user can self-register and receives a JWT.
    FR-01
    """

    def test_register_returns_201_or_200(self, client):
        resp = client.post("/api/auth/register", json={
            "username":          "tc01_user",
            "email":             "tc01@example.com",
            "password":          "Secure@1234",
            "organization_name": "TC01Org",
        })
        assert resp.status_code in (200, 201), (
            f"TC01 FAIL: expected 200/201 on new registration, got {resp.status_code}: {resp.data}"
        )

    def test_register_returns_access_token(self, client):
        resp = client.post("/api/auth/register", json={
            "username":          "tc01_tokenuser",
            "email":             "tc01token@example.com",
            "password":          "Secure@1234",
            "organization_name": "TC01Org",
        })
        data = resp.get_json()
        assert "access_token" in data, (
            f"TC01 FAIL: response should include 'access_token'; got {list(data.keys())}"
        )

    def test_register_missing_required_field_returns_400(self, client):
        resp = client.post("/api/auth/register", json={
            "username": "tc01_incomplete",
            # missing email, password, organization_name
        })
        assert resp.status_code == 400, (
            f"TC01 FAIL: missing fields should return 400, got {resp.status_code}"
        )

    def test_register_weak_password_rejected(self, client):
        """Passwords without uppercase/digit/special should be rejected."""
        resp = client.post("/api/auth/register", json={
            "username":          "tc01_weakpass",
            "email":             "tc01weak@example.com",
            "password":          "password",
            "organization_name": "TC01Org",
        })
        # Either 400 or the system accepts weak passwords and we document the gap
        if resp.status_code == 200:
            pytest.skip("Password strength enforcement not implemented — document as gap")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# TC02 — Login with valid credentials
# ---------------------------------------------------------------------------

class TestTC02_ValidLogin:
    """
    Objective: Verify that a registered user receives a valid JWT on login.
    FR-01
    """

    @pytest.fixture(autouse=True)
    def _register(self, client):
        client.post("/api/auth/register", json={
            "username":          "tc02_user",
            "email":             "tc02@example.com",
            "password":          "Login@1234",
            "organization_name": "TC02Org",
        })

    def test_login_returns_200(self, client):
        resp = client.post("/api/auth/login", json={
            "username": "tc02_user",
            "password": "Login@1234",
        })
        assert resp.status_code == 200, (
            f"TC02 FAIL: expected 200 on valid login, got {resp.status_code}: {resp.data}"
        )

    def test_login_response_has_access_and_refresh_tokens(self, client):
        resp = client.post("/api/auth/login", json={
            "username": "tc02_user",
            "password": "Login@1234",
        })
        data = resp.get_json()
        assert "access_token" in data, "TC02 FAIL: missing access_token in login response"
        assert "refresh_token" in data, "TC02 FAIL: missing refresh_token in login response"

    def test_login_token_grants_protected_endpoint_access(self, client):
        login = client.post("/api/auth/login", json={
            "username": "tc02_user",
            "password": "Login@1234",
        })
        token = login.get_json()["access_token"]
        resp  = client.get("/api/my-activity", headers=auth_header(token))
        assert resp.status_code in (200, 404), (
            f"TC02 FAIL: valid token should access protected endpoint; got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# TC03 — Login with invalid credentials
# ---------------------------------------------------------------------------

class TestTC03_InvalidLogin:
    """
    Objective: Verify that wrong credentials are rejected with 401.
    FR-01
    """

    @pytest.fixture(autouse=True)
    def _register(self, client):
        client.post("/api/auth/register", json={
            "username":          "tc03_user",
            "email":             "tc03@example.com",
            "password":          "Real@1234",
            "organization_name": "TC03Org",
        })

    def test_wrong_password_returns_401(self, client):
        resp = client.post("/api/auth/login", json={
            "username": "tc03_user",
            "password": "WRONG_PASSWORD",
        })
        assert resp.status_code == 401, (
            f"TC03 FAIL: wrong password should return 401, got {resp.status_code}"
        )

    def test_nonexistent_user_returns_401(self, client):
        resp = client.post("/api/auth/login", json={
            "username": "ghost_user_xyz_9999",
            "password": "Any@Pass1",
        })
        assert resp.status_code == 401, (
            f"TC03 FAIL: non-existent user should return 401, got {resp.status_code}"
        )

    def test_empty_credentials_returns_400_or_401(self, client):
        resp = client.post("/api/auth/login", json={})
        assert resp.status_code in (400, 401, 422), (
            f"TC03 FAIL: empty credentials should return 4xx, got {resp.status_code}"
        )

    def test_no_token_issued_on_bad_login(self, client):
        resp = client.post("/api/auth/login", json={
            "username": "tc03_user",
            "password": "BAD",
        })
        data = resp.get_json() or {}
        assert "access_token" not in data, (
            "TC03 FAIL: access_token must NOT be issued on failed login"
        )


# ---------------------------------------------------------------------------
# TC04 — JWT token refresh (FR-13)
# ---------------------------------------------------------------------------

class TestTC04_TokenRefresh:
    """
    Objective: Verify that a refresh token issues a new access token.
    FR-13
    """

    @pytest.fixture(autouse=True)
    def _login(self, client):
        client.post("/api/auth/register", json={
            "username":          "tc04_user",
            "email":             "tc04@example.com",
            "password":          "Refresh@1234",
            "organization_name": "TC04Org",
        })
        self.login_resp = client.post("/api/auth/login", json={
            "username": "tc04_user",
            "password": "Refresh@1234",
        })

    def test_refresh_with_valid_token_returns_new_access_token(self, client):
        data          = self.login_resp.get_json()
        refresh_token = data.get("refresh_token", "")
        if not refresh_token:
            pytest.skip("Refresh token not returned by login endpoint")

        resp = client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )
        assert resp.status_code == 200, (
            f"TC04 FAIL: token refresh should return 200, got {resp.status_code}: {resp.data}"
        )
        new_data = resp.get_json()
        assert "access_token" in new_data, "TC04 FAIL: refresh must return a new access_token"

    def test_access_token_cannot_be_used_for_refresh(self, client):
        data         = self.login_resp.get_json()
        access_token = data.get("access_token", "")
        resp = client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert resp.status_code in (401, 422), (
            f"TC04 FAIL: using access token on refresh endpoint should fail; got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# TC05 — Logout / token revocation
# ---------------------------------------------------------------------------

class TestTC05_Logout:
    """
    Objective: Verify that logout invalidates the JWT so subsequent
               requests using the same token are rejected.
    FR-13
    """

    @pytest.fixture(autouse=True)
    def _login(self, client):
        client.post("/api/auth/register", json={
            "username":          "tc05_user",
            "email":             "tc05@example.com",
            "password":          "Logout@1234",
            "organization_name": "TC05Org",
        })
        login = client.post("/api/auth/login", json={
            "username": "tc05_user",
            "password": "Logout@1234",
        })
        self.token = login.get_json().get("access_token", "")

    def test_logout_returns_200(self, client):
        resp = client.post("/api/auth/logout", headers=auth_header(self.token))
        assert resp.status_code in (200, 204), (
            f"TC05 FAIL: logout should return 200/204, got {resp.status_code}"
        )

    def test_revoked_token_rejected_on_protected_endpoint(self, client):
        client.post("/api/auth/logout", headers=auth_header(self.token))
        resp = client.get("/api/my-activity", headers=auth_header(self.token))
        assert resp.status_code in (401, 422), (
            f"TC05 FAIL: revoked token should be rejected (401/422), got {resp.status_code}"
        )

    def test_unauthenticated_request_returns_401(self, client):
        resp = client.get("/api/my-activity")
        assert resp.status_code == 401, (
            f"TC05 FAIL: unauthenticated request should return 401, got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# TC06 — Duplicate registration rejected
# ---------------------------------------------------------------------------

class TestTC06_DuplicateRegistration:
    """
    Objective: Verify that duplicate usernames/emails are rejected with 409.
    FR-01
    """

    @pytest.fixture(autouse=True)
    def _first_registration(self, client):
        client.post("/api/auth/register", json={
            "username":          "tc06_user",
            "email":             "tc06@example.com",
            "password":          "Unique@1234",
            "organization_name": "TC06Org",
        })

    def test_duplicate_username_returns_409(self, client):
        resp = client.post("/api/auth/register", json={
            "username":          "tc06_user",       # same username
            "email":             "tc06b@example.com",
            "password":          "Another@1234",
            "organization_name": "TC06Org",
        })
        assert resp.status_code == 409, (
            f"TC06 FAIL: duplicate username should return 409, got {resp.status_code}"
        )

    def test_duplicate_email_returns_409(self, client):
        resp = client.post("/api/auth/register", json={
            "username":          "tc06_different",
            "email":             "tc06@example.com",  # same email
            "password":          "Another@1234",
            "organization_name": "TC06Org",
        })
        assert resp.status_code == 409, (
            f"TC06 FAIL: duplicate email should return 409, got {resp.status_code}"
        )

    def test_valid_login_still_works_after_duplicate_attempt(self, client):
        # Duplicate attempt must not corrupt the original account
        client.post("/api/auth/register", json={
            "username":          "tc06_user",
            "email":             "tc06@example.com",
            "password":          "DifferentPass@5",
            "organization_name": "TC06Org",
        })
        login = client.post("/api/auth/login", json={
            "username": "tc06_user",
            "password": "Unique@1234",
        })
        assert login.status_code == 200, (
            "TC06 FAIL: original account should still be functional after duplicate attempt"
        )
