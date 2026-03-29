from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.services.embedding_svc import generate_org_embedding, search_by_embedding
from app.services.supabase_client import get_supabase_client

logger = structlog.get_logger()
router = APIRouter(prefix="/embeddings", tags=["embeddings"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class GenerateEmbeddingRequest(BaseModel):
    """Request body for POST /embeddings/generate.

    Attributes:
        org_id: UUID of the organisation to embed.
    """

    org_id: str


class GenerateEmbeddingResponse(BaseModel):
    """Response from POST /embeddings/generate.

    Attributes:
        org_id: UUID of the embedded organisation.
        dims: Dimensionality of the generated vector.
        status: 'ok' on success.
    """

    org_id: str
    dims: int
    status: str


class SearchResult(BaseModel):
    """A single result from semantic similarity search.

    Attributes:
        id: Organisation UUID.
        name: Organisation name.
        slug: URL slug.
        similarity: Cosine similarity score (0-1; higher is more similar).
    """

    id: str
    name: str | None = None
    slug: str | None = None
    similarity: float


class SearchResponse(BaseModel):
    """Response from POST /embeddings/search.

    Attributes:
        query: The original search string.
        results: Ranked list of matching organisations.
    """

    query: str
    results: list[SearchResult]


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------


def _db_client() -> Any:
    """FastAPI dependency returning the Supabase client.

    Raises:
        HTTPException 503: If the Supabase client is not configured.
    """
    try:
        return get_supabase_client()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/generate",
    response_model=GenerateEmbeddingResponse,
    summary="Generate and store text embedding for an organisation",
)
async def generate_embeddings(
    body: GenerateEmbeddingRequest,
    db: Any = Depends(_db_client),
) -> GenerateEmbeddingResponse:
    """Encode an organisation's descriptive fields and upsert the pgvector.

    Fetches name, description, sector, subsector, country, and org_type;
    concatenates them into a structured text blob; calls the OpenAI
    ``text-embedding-3-small`` model; and upserts the 1536-dim result into
    ``organizations.embedding``.

    Args:
        body: Request containing org_id.
        db: Supabase client (injected by FastAPI dependency).

    Returns:
        GenerateEmbeddingResponse confirming org_id and vector dimensionality.

    Raises:
        HTTPException 400: If org_id is blank.
        HTTPException 404: If the organisation does not exist.
        HTTPException 503: If the Supabase or OpenAI client is not configured.
    """
    if not body.org_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="org_id must not be empty",
        )

    logger.info("generate_embeddings_called", org_id=body.org_id)

    try:
        vector = await generate_org_embedding(body.org_id, db)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return GenerateEmbeddingResponse(
        org_id=body.org_id,
        dims=len(vector),
        status="ok",
    )


@router.post(
    "/search",
    response_model=SearchResponse,
    summary="Semantic similarity search over organisation embeddings",
)
async def search_embeddings(
    query: str = Query(..., description="Natural-language search query"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of results"),
    db: Any = Depends(_db_client),
) -> SearchResponse:
    """Embed the query string and return the most similar organisations.

    Calls the ``match_organizations`` Supabase RPC function which executes
    a pgvector cosine-similarity scan against ``organizations.embedding``.

    Args:
        query: Free-text search string.
        limit: Maximum number of results to return (1-100).
        db: Supabase client (injected by FastAPI dependency).

    Returns:
        SearchResponse with a ranked list of matching organisations and
        their similarity scores.

    Raises:
        HTTPException 400: If query is blank.
        HTTPException 503: If the Supabase or OpenAI client is not configured.
    """
    if not query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="query must not be empty",
        )

    logger.info("search_embeddings_called", query=query, limit=limit)

    try:
        raw_results = await search_by_embedding(query, db, limit=limit)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    results = [
        SearchResult(
            id=r.get("id", ""),
            name=r.get("name"),
            slug=r.get("slug"),
            similarity=float(r.get("similarity", 0.0)),
        )
        for r in raw_results
    ]

    return SearchResponse(query=query, results=results)
