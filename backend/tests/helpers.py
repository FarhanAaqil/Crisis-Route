"""Test helpers for authenticated API calls."""

from fastapi.testclient import TestClient

from app.domain.models import UserRole
from app.main import app
from app.security.auth import create_access_token


def auth_headers(
    role: UserRole | str,
    user_id: str | None = None,
    username: str | None = None,
) -> dict[str, str]:
    """Build an Authorization header carrying a validly signed token for the given role."""
    role = UserRole(role)
    uid = user_id or f"{role.value}-test"
    token = create_access_token(uid, username or uid, role)
    return {"Authorization": f"Bearer {token}"}


def make_client(role: UserRole = UserRole.ANALYST) -> TestClient:
    """TestClient that signs every request as ``role`` unless a call overrides Authorization."""
    client = TestClient(app)
    client.headers.update(auth_headers(role))
    return client
