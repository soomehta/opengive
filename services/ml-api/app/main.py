from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import agents, analysis, embeddings, entities

logger = structlog.get_logger()

ML_API_SECRET = os.environ.get("ML_API_SECRET", "")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan handler — runs startup and shutdown logic."""
    if not ML_API_SECRET:
        logger.warning("ml_api_secret_not_set", msg="ML_API_SECRET is empty — all requests will be rejected")
    logger.info(
        "ml_api_starting",
        title=app.title,
        version=app.version,
    )
    yield
    logger.info("ml_api_shutdown")


app = FastAPI(
    title="OpenGive ML API",
    description=(
        "Machine learning and analysis service for OpenGive. "
        "Provides anomaly detection, Benford's Law analysis, "
        "Splink entity resolution, text embeddings, and LangGraph "
        "multi-agent investigation pipelines."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

# CORS — restrict to known origins only
_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "").split(",")
_allowed_origins = [o.strip() for o in _allowed_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins or [],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Service-Secret"],
)


@app.middleware("http")
async def verify_service_auth(request: Request, call_next):
    """Enforce service-to-service authentication via X-Service-Secret header.

    The /health and /docs endpoints are exempt so load balancers and
    developers can access them without credentials.
    """
    exempt_paths = {"/health", "/docs", "/redoc", "/openapi.json"}
    if request.url.path in exempt_paths:
        return await call_next(request)

    token = request.headers.get("x-service-secret", "")
    if not ML_API_SECRET or token != ML_API_SECRET:
        logger.warning("ml_api_auth_rejected", path=str(request.url.path))
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized — valid X-Service-Secret header required"},
        )
    return await call_next(request)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(analysis.router)
app.include_router(embeddings.router)
app.include_router(entities.router)
app.include_router(agents.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    """Liveness probe used by Railway and load balancers."""
    return {"status": "ok", "service": "ml-api", "version": "0.1.0"}
