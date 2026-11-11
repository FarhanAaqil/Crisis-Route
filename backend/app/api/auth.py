"""Operator sign-in and session identity endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.domain.models import UserRole
from app.security.auth import (
    CurrentUser,
    check_login_allowed,
    clear_login_failures,
    create_access_token,
    get_current_user,
    record_audit_event,
    record_login_failure,
)
from app.security.users import get_users, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Used to spend the same time on unknown usernames as on wrong passwords
_DUMMY_HASH = hash_password("not-a-real-password")


class LoginRequest(BaseModel):
    """Operator credentials."""

    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=256)


class SessionUser(BaseModel):
    """Identity returned to the client after sign-in."""

    user_id: str
    username: str
    display_name: str
    role: UserRole


class LoginResponse(BaseModel):
    """Bearer token and the operator it was issued to."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: SessionUser


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request) -> LoginResponse:
    """Exchange operator credentials for a short-lived bearer token."""
    username = payload.username.strip().lower()
    client_ip = request.client.host if request.client else "unknown"
    throttle_key = f"{username}|{client_ip}"
    check_login_allowed(throttle_key)

    record = get_users().get(username)
    stored = record.password_hash if record else _DUMMY_HASH
    valid = verify_password(payload.password, stored)
    if not record or not valid:
        record_login_failure(throttle_key)
        record_audit_event(
            user_id=username,
            action="LOGIN_FAILED",
            resource_type="session",
            resource_id=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    clear_login_failures(throttle_key)
    token = create_access_token(record.user_id, record.display_name, record.role)
    record_audit_event(
        user_id=record.user_id,
        action="LOGIN",
        resource_type="session",
        resource_id=client_ip,
    )
    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
        user=SessionUser(
            user_id=record.user_id,
            username=record.username,
            display_name=record.display_name,
            role=record.role,
        ),
    )


@router.get("/me", response_model=CurrentUser)
def whoami(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Return the operator behind the presented token."""
    return current_user
