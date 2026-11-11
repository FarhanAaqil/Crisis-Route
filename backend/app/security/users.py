"""User directory and password hashing for CrisisRoute operators.

Passwords are stored as scrypt hashes. In development a small set of demo operators is provided
so the UI can be explored immediately; in production operators must be supplied through a JSON
file referenced by CRISISROUTE_USERS_FILE. Generate a hash with:

    python -m app.security.users hash
"""

import base64
import getpass
import hashlib
import hmac
import json
import logging
import secrets
import sys
from dataclasses import dataclass

from app.core.config import settings
from app.domain.models import UserRole

logger = logging.getLogger("crisisroute.security")

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
DEMO_PASSWORD = "crisisroute-demo"


@dataclass(frozen=True)
class UserRecord:
    """A registered operator."""

    user_id: str
    username: str
    display_name: str
    role: UserRole
    password_hash: str


def hash_password(password: str, salt: bytes | None = None) -> str:
    """Return an scrypt hash string: scrypt$n$r$p$salt$digest (base64)."""
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=32
    )
    return "$".join(
        [
            "scrypt",
            str(_SCRYPT_N),
            str(_SCRYPT_R),
            str(_SCRYPT_P),
            base64.b64encode(salt).decode(),
            base64.b64encode(digest).decode(),
        ]
    )


def verify_password(password: str, stored: str) -> bool:
    """Constant-time check of a password against a stored scrypt hash."""
    try:
        scheme, n, r, p, salt_b64, digest_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=base64.b64decode(salt_b64),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def _demo_users() -> list[UserRecord]:
    pw_hash = hash_password(DEMO_PASSWORD)
    return [
        UserRecord("analyst-001", "analyst", "Logistics Analyst", UserRole.ANALYST, pw_hash),
        UserRecord("field-001", "field", "Field Analyst", UserRole.FIELD_ANALYST, pw_hash),
        UserRecord("approver-001", "approver", "Incident Lead", UserRole.APPROVER, pw_hash),
        UserRecord("admin-001", "admin", "System Administrator", UserRole.ADMIN, pw_hash),
    ]


def load_users() -> dict[str, UserRecord]:
    """Load operators from CRISISROUTE_USERS_FILE, or demo operators outside production."""
    if settings.users_file:
        raw = json.loads(settings.users_file.read_text(encoding="utf-8"))
        records = [
            UserRecord(
                user_id=str(item["user_id"]),
                username=str(item["username"]).lower(),
                display_name=str(item.get("display_name") or item["username"]),
                role=UserRole(item["role"]),
                password_hash=str(item["password_hash"]),
            )
            for item in raw
        ]
    elif settings.is_production:
        raise RuntimeError("CRISISROUTE_USERS_FILE is required when running in production")
    else:
        logger.warning(
            "Using built-in demo operators (analyst/field/approver/admin, password '%s'). "
            "Never expose this configuration publicly.",
            DEMO_PASSWORD,
        )
        records = _demo_users()
    return {r.username: r for r in records}


_USERS: dict[str, UserRecord] | None = None


def get_users() -> dict[str, UserRecord]:
    """Lazily load and cache the user directory."""
    global _USERS
    if _USERS is None:
        _USERS = load_users()
    return _USERS


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "hash":
        print(hash_password(getpass.getpass("Password: ")))
    else:
        print("usage: python -m app.security.users hash")
