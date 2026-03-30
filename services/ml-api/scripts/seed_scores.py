#!/usr/bin/env python3
"""Seed organization_scores by running scoring on all seeded orgs."""
from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()


async def main() -> None:
    """Fetch all organisations from Supabase and compute a transparency score for each.

    Reads configuration from environment variables:
        ML_API_URL: Base URL of the ML API (default http://localhost:8000).
        ML_API_SECRET: Service secret forwarded as X-Service-Secret header.
        SUPABASE_URL: Supabase project URL (required).
        SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (required).
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

    async with httpx.AsyncClient(timeout=60, headers=headers) as client:
        for org in orgs:
            org_id: str = org["id"]
            try:
                resp = await client.get(
                    f"{base}/analysis/score/{org_id}",
                    params={"persist": "true"},
                )
                resp.raise_for_status()
                data: dict[str, Any] = resp.json()
                logger.info(
                    "processed",
                    org_id=org_id,
                    overall_score=data.get("overall_score"),
                    fiscal_year=data.get("fiscal_year"),
                )
            except Exception as exc:
                logger.warning("failed", org_id=org_id, error=str(exc))


if __name__ == "__main__":
    asyncio.run(main())
