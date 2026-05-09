"""JWT shared secret validation entre Node backend e iga-ai."""

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from iga_ai.config import Settings, get_settings


class SharedJwtClaims(BaseModel):
    iss: str
    aud: str
    sub: str  # user_id
    tid: str  # tenant_id
    role: str
    plan: str = "free"
    exp: int
    iat: int
    jti: str | None = None
    name: str | None = None  # user_name (optional)
    monthly_goal: float | None = Field(default=None, alias="goal")


def _extract_bearer(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_bearer")
    return auth[7:].strip()


def verify_shared_jwt(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> SharedJwtClaims:
    """Valida JWT HS256 emitido pelo backend Node, com aud=iga-ai e exp curto.

    Em modo dev (sem secret configurado), aceita um token "dev" para facilitar
    teste local. Em prod, secret obrigatorio.
    """
    token = _extract_bearer(request)
    secret = settings.iga_ai_shared_secret
    if not secret:
        if settings.is_production:
            raise HTTPException(status_code=500, detail="shared_secret_not_configured")
        # Dev fallback: token literal "dev" eh aceito
        if token == "dev":
            return SharedJwtClaims(
                iss="iga-backend",
                aud="iga-ai",
                sub="dev-user",
                tid="dev-tenant",
                role="admin",
                plan="pro",
                exp=2147483647,
                iat=0,
            )
    try:
        decoded = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="iga-ai",
            issuer="iga-backend",
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="token_expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="invalid_token") from exc
    return SharedJwtClaims(**decoded)


CurrentClaims = Annotated[SharedJwtClaims, Depends(verify_shared_jwt)]
