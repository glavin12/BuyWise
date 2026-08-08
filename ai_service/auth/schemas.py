from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class CurrentUser(BaseModel):
    """Authenticated identity extracted from a verified Supabase JWT.

    This is the ONLY source of ``user_id`` trusted by the application.
    It is injected into endpoints via ``Depends(get_current_user)`` and
    must never be populated from a request body, path, or query param.
    """

    id: UUID
    email: str | None = None
    role: str | None = None
    session_id: UUID | None = None


class TokenPayload(BaseModel):
    """Internal representation of the decoded JWT claims.

    Only the fields the auth module actually validates/exposes are typed;
    Supabase tokens carry more claims (aal, amr, app_metadata, ...) which
    are ignored here intentionally.
    """

    sub: str
    email: str | None = None
    role: str | None = None
    session_id: str | None = None
    iss: str | None = None
    aud: str | list[str] | None = None
    exp: int | None = None