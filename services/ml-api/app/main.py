from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import agents, analysis, embeddings, entities

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan handler — runs startup and shutdown logic."""
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    """Liveness probe used by Railway and load balancers.

    Returns:
        Dict with ``status``, ``service``, and ``version`` keys.
    """
    return {"status": "ok", "service": "ml-api", "version": "0.1.0"}
