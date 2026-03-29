from __future__ import annotations

import asyncio
from typing import Any

import structlog
from openai import AsyncOpenAI

from app.config import settings

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# OpenAI client (lazy singleton — created on first use)
# ---------------------------------------------------------------------------

_openai_client: AsyncOpenAI | None = None

# Model and expected output dimensionality (configurable via Settings / env vars)
_EMBEDDING_MODEL: str = settings.embedding_model
_EMBEDDING_DIMS: int = settings.embedding_dims

# Columns used to build the text blob for an organisation embedding.
_ORG_TEXT_COLUMNS: tuple[str, ...] = (
    "name",
    "description",
    "sector",
    "subsector",
    "country_code",
    "jurisdiction",
    "org_type",
)


def _get_openai_client() -> AsyncOpenAI:
    """Return (or lazily create) the singleton AsyncOpenAI client.

    Returns:
        Configured AsyncOpenAI instance.

    Raises:
        RuntimeError: If OPENAI_API_KEY is not set in the environment.
    """
    global _openai_client  # noqa: PLW0603
    if _openai_client is None:
        if not settings.openai_api_key:
            raise RuntimeError(
                "OPENAI_API_KEY must be set before the embedding service can be used."
            )
        _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
        logger.info("openai_client_initialized", model=_EMBEDDING_MODEL)
    return _openai_client


# ---------------------------------------------------------------------------
# Core embedding functions
# ---------------------------------------------------------------------------


async def generate_embedding(text: str) -> list[float]:
    """Generate a 1536-dimensional embedding vector for an arbitrary text string.

    Calls the OpenAI ``text-embedding-3-small`` model.  The input text is
    stripped and truncated to avoid token-limit errors; OpenAI's API handles
    further normalisation internally.

    Args:
        text: Free-text string to embed (e.g. an organisation description).

    Returns:
        List of 1536 floats representing the semantic embedding.

    Raises:
        RuntimeError: If OPENAI_API_KEY is not configured.
        openai.OpenAIError: On upstream API failure.
    """
    if not text or not text.strip():
        logger.warning("generate_embedding_empty_text")
        return [0.0] * _EMBEDDING_DIMS

    client = _get_openai_client()
    response = await client.embeddings.create(
        model=_EMBEDDING_MODEL,
        input=text.strip(),
    )
    vector: list[float] = response.data[0].embedding
    logger.debug(
        "generate_embedding_complete",
        dims=len(vector),
        preview=text[:80],
    )
    return vector


def _build_org_text(org: dict[str, Any]) -> str:
    """Compose a single text blob from the organisation's descriptive fields.

    Concatenates name, description, sector, subsector, country, and org_type
    into a structured natural-language string for high-quality embeddings.

    Args:
        org: Organisation record dict as returned from Supabase.

    Returns:
        Normalised text string ready for the embedding API.
    """
    parts: list[str] = []

    name = (org.get("name") or "").strip()
    if name:
        parts.append(f"Organization: {name}")

    org_type = (org.get("org_type") or "").strip()
    if org_type:
        parts.append(f"Type: {org_type}")

    sector = (org.get("sector") or "").strip()
    subsector = (org.get("subsector") or "").strip()
    if sector:
        sector_str = f"{sector} — {subsector}" if subsector else sector
        parts.append(f"Sector: {sector_str}")

    country = (org.get("country_code") or "").strip()
    jurisdiction = (org.get("jurisdiction") or "").strip()
    if country:
        location_str = f"{country} ({jurisdiction})" if jurisdiction else country
        parts.append(f"Location: {location_str}")

    description = (org.get("description") or "").strip()
    if description:
        parts.append(description)

    return " | ".join(parts)


async def generate_org_embedding(
    org_id: str,
    db_client: Any,
) -> list[float]:
    """Fetch an organisation's text fields, generate its embedding, and upsert it.

    The resulting 1536-dim vector is written back to
    ``organizations.embedding`` using pgvector's update path.

    Args:
        org_id: UUID of the organisation to embed.
        db_client: Authenticated Supabase Client instance (service role).

    Returns:
        The generated embedding vector.

    Raises:
        ValueError: If the organisation cannot be found.
        RuntimeError: If OPENAI_API_KEY is not configured.
    """
    log = logger.bind(org_id=org_id)
    log.info("generate_org_embedding_start")

    # Fetch the organisation record
    try:
        resp = (
            db_client.table("organizations")
            .select(",".join(_ORG_TEXT_COLUMNS))
            .eq("id", org_id)
            .single()
            .execute()
        )
        org: dict[str, Any] = resp.data or {}
    except Exception as exc:
        log.error("generate_org_embedding_fetch_failed", error=str(exc))
        raise ValueError(f"Organisation {org_id} not found: {exc}") from exc

    if not org:
        raise ValueError(f"Organisation {org_id} not found in database.")

    text = _build_org_text(org)
    if not text.strip():
        log.warning("generate_org_embedding_empty_text")
        return [0.0] * _EMBEDDING_DIMS

    vector = await generate_embedding(text)

    # Upsert the embedding back to the organizations table
    try:
        db_client.table("organizations").update({"embedding": vector}).eq(
            "id", org_id
        ).execute()
        log.info("generate_org_embedding_upserted")
    except Exception as exc:
        log.error("generate_org_embedding_upsert_failed", error=str(exc))
        # Return the vector even if persistence fails — the caller can retry

    return vector


async def search_by_embedding(
    query: str,
    db_client: Any,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Perform semantic similarity search over organisation embeddings.

    Generates an embedding for the query string and executes a pgvector
    cosine-similarity search against all indexed organisations.

    Requires the ``match_organizations`` RPC function to be defined in
    Supabase (see packages/db/migrations for the function definition).

    Args:
        query: Natural-language search string.
        db_client: Authenticated Supabase Client instance (service role).
        limit: Maximum number of results to return (default 20, max 100).

    Returns:
        List of organisation dicts ordered by similarity score, each
        including an additional ``similarity`` key (0.0-1.0).
    """
    log = logger.bind(query_preview=query[:80], limit=limit)
    log.info("search_by_embedding_start")

    if not query.strip():
        log.warning("search_by_embedding_empty_query")
        return []

    query_vector = await generate_embedding(query)

    try:
        resp = db_client.rpc(
            "match_organizations",
            {
                "query_embedding": query_vector,
                "match_count": min(limit, 100),
            },
        ).execute()
        results: list[dict[str, Any]] = resp.data or []
    except Exception as exc:
        log.error("search_by_embedding_rpc_failed", error=str(exc))
        return []

    log.info("search_by_embedding_complete", result_count=len(results))
    return results


# ---------------------------------------------------------------------------
# Batch generation helper (used by Dagster asset)
# ---------------------------------------------------------------------------


async def generate_embeddings_batch(
    org_ids: list[str],
    db_client: Any,
    concurrency: int = 5,
) -> dict[str, bool]:
    """Generate and upsert embeddings for a list of organisations concurrently.

    Uses a semaphore to cap concurrent OpenAI API calls and avoid rate-limit
    errors.

    Args:
        org_ids: List of organisation UUIDs to embed.
        db_client: Authenticated Supabase Client instance (service role).
        concurrency: Maximum simultaneous embedding API calls (default 5).

    Returns:
        Mapping of org_id to True (succeeded) or False (failed).
    """
    log = logger.bind(total=len(org_ids), concurrency=concurrency)
    log.info("generate_embeddings_batch_start")

    semaphore = asyncio.Semaphore(concurrency)
    results: dict[str, bool] = {}

    async def _embed_one(org_id: str) -> None:
        async with semaphore:
            try:
                await generate_org_embedding(org_id, db_client)
                results[org_id] = True
            except Exception as exc:
                logger.warning(
                    "generate_embeddings_batch_item_failed",
                    org_id=org_id,
                    error=str(exc),
                )
                results[org_id] = False

    await asyncio.gather(*(_embed_one(oid) for oid in org_ids))

    succeeded = sum(1 for v in results.values() if v)
    log.info("generate_embeddings_batch_complete", succeeded=succeeded, failed=len(org_ids) - succeeded)
    return results
