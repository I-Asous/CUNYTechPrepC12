"""Who is calling: checks the Clerk session token the frontend sends.

Signed-in requests carry `Authorization: Bearer <token>`. The token is a JWT
signed by Clerk; we check its signature against Clerk's public keys
(CLERK_JWKS_URL) and use its `sub` claim, the Clerk user ID, as the user's ID.
Guests send no header and can still use every endpoint that doesn't save
anything.

Settings (environment variables):
    CLERK_JWKS_URL            https://<your-frontend-api>/.well-known/jwks.json
    CLERK_AUTHORIZED_PARTIES  optional, comma-separated site origins allowed to
                              send tokens, e.g. https://chess-coach.onrender.com
"""

import os
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException

LEEWAY_SECONDS = 5  # tolerate small clock differences with Clerk's servers


@lru_cache
def _jwks_client():
    url = os.environ.get("CLERK_JWKS_URL")
    return jwt.PyJWKClient(url) if url else None  # caches the keys after the first fetch


@lru_cache
def _authorized_parties():
    raw = os.environ.get("CLERK_AUTHORIZED_PARTIES", "")
    return {origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()}


def user_from_token(token):
    """The Clerk user ID in a session token. Raises HTTPException if it isn't valid."""
    client = _jwks_client()
    if client is None:
        raise HTTPException(503, "Sign-in isn't set up on this server (CLERK_JWKS_URL is missing).")
    try:
        key = client.get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["RS256"], leeway=LEEWAY_SECONDS,
                            options={"require": ["exp", "sub"]})
    except jwt.PyJWKClientConnectionError:
        raise HTTPException(503, "Couldn't reach Clerk to check the sign-in.")
    except (jwt.PyJWTError, jwt.PyJWKClientError):
        raise HTTPException(401, "Your session is invalid or expired. Sign in again.")

    # Reject tokens that Clerk issued for some other site.
    parties = _authorized_parties()
    if parties and claims.get("azp") not in parties:
        raise HTTPException(401, "This session was issued for a different site.")
    return claims["sub"]


def optional_user(authorization: str | None = Header(default=None)):
    """Dependency: the caller's user ID, or None for a guest."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Expected an 'Authorization: Bearer <token>' header.")
    return user_from_token(token)


def current_user(user: str | None = Depends(optional_user)):
    """Dependency: the caller's user ID; guests get a 401."""
    if user is None:
        raise HTTPException(401, "Sign in to use this.")
    return user
