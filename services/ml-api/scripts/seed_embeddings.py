#!/usr/bin/env python3
"""Seed organizations.embedding by generating embeddings for all seeded orgs."""
from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()

# Max concurrent embedding API calls — keeps OpenAI rate limits comfortable.
_CONCURRENCY: int = int(os.environ.get("SEED_EMBEDDINGS_CONCURRENCY", "5"))


async def main() -> None:
    """Fetch all organisations from Supabase and generate a pgvector embedding for each.

    Uses a semaphore to cap concurrent OpenAI API calls.

    Reads configuration from environment variables:
        ML_API_URL: Base URL of the ML API (default http://localhost:8000).
        ML_API_SECRET: Service secret forwarded as X-Service-Secret header.
        SUPABASE_URL: Supabase project URL (required).
        SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (required).
        SEED_EMBEDDINGS_CONCURRENCY: Max parallel requests (default 5).
    """
    base: str = os.environ.get("ML_API_URL", "http://localhost:8000")
    secret: str = os.environ.get("ML_API_SECRET", "")
    supabase_url: str = os.environ["SUPABASE_URL"]
    supabase_key: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if secret:
        headers["X-Service-Secret"] = secret

    # Fetch all org IDs
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{supabase_url}/rest/v1/organizations?select=id&limit=1000",
            headers={
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
            },
        )
        resp.raise_for_status()
        orgs: list[dict[str, Any]] = resp.json()

    logger.info("found_orgs", count=len(orgs))

    semaphore = asyncio.Semaphore(_CONCURRENCY)
    succeeded = 0
    failed = 0

    async def _embed_one(client: httpx.AsyncClient, org_id: str) -> bool:
        """Generate embedding for one organisation.

        Args:
            client: Shared async HTTP client.
            org_id: UUID of the organisation.

        Returns:
            True on success, False on failure.
        """
        async with semaphore:
            try:
                resp = await client.post(
                    f"{base}/embeddings/generate",
                    json={"org_id": org_id},
                )
                resp.raise_for_status()
                data: dict[str, Any] = resp.json()
                logger.info(
                    "processed",
                    org_id=org_id,
                    dims=data.get("dims"),
                    status=data.get("status"),
                )
                return True
            except Exception as exc:
                logger.warning("failed", org_id=org_id, error=str(exc))
                return False

    async with httpx.AsyncClient(timeout=60, headers=headers) as client:
        tasks = [_embed_one(client, org["id"]) for org in orgs]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, Exception):
            failed += 1
        elif result:
            succeeded += 1
        else:
            failed += 1

    logger.info("seed_embeddings_complete", succeeded=succeeded, failed=failed)


if __name__ == "__main__":
    asyncio.run(main())
