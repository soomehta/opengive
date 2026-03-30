from __future__ import annotations

from typing import Any

import pandas as pd
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.services.splink_resolver import load_entity_matches, resolve_entities
from app.services.supabase_client import get_supabase_client

logger = structlog.get_logger()
router = APIRouter(prefix="/entities", tags=["entities"])

# Columns fetched from Supabase to build Splink input DataFrames.
_ORG_COLUMNS: str = "id,name,country_code,city,registration_id,source_registry"


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
# Helpers
# ---------------------------------------------------------------------------


def _fetch_registry_orgs(db: Any, registry: str) -> pd.DataFrame:
    """Fetch organisations belonging to a given source registry from Supabase.

    Renames ``id`` to ``unique_id`` and fills NaN values with empty strings
    so that Splink comparisons do not error on nulls.

    Args:
        db: Authenticated Supabase Client (service role).
        registry: Source registry slug to filter on (e.g. ``'us-irs'``).

    Returns:
        DataFrame with columns required by :func:`splink_resolver.resolve_entities`.

    Raises:
        HTTPException 404: If no organisations are found for the registry.
    """
    try:
        resp = (
            db.table("organizations")
            .select(_ORG_COLUMNS)
            .eq("source_registry", registry)
            .execute()
        )
        rows: list[dict[str, Any]] = resp.data or []
    except Exception as exc:
        logger.error(
            "entities_fetch_registry_failed",
            registry=registry,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch organisations for registry '{registry}': {exc}",
        ) from exc

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No organisations found for registry '{registry}'.",
        )

    df = pd.DataFrame(rows)
    # Splink requires a 'unique_id' column; organisations use 'id'
    df = df.rename(columns={"id": "unique_id"})
    # Ensure all required columns exist (fill missing ones with empty string)
    for col in ("name", "country_code", "city", "registration_id"):
        if col not in df.columns:
            df[col] = ""
    df = df.fillna("")
    return df[["unique_id", "name", "country_code", "city", "registration_id"]]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/resolve")
async def resolve_entities_endpoint(
    source_registry: str = Query(
        ..., description="Source registry slug (e.g. 'us-irs', 'uk-ccew')"
    ),
    target_registry: str = Query(
        ..., description="Target registry slug to match against"
    ),
    db: Any = Depends(_db_client),
) -> dict[str, Any]:
    """Run Splink probabilistic entity resolution between two registry datasets.

    Loads organisation records from both registries from Supabase, executes
    the Splink DuckDB linker with trained parameters, classifies matches as
    confirmed / probable / possible, and persists results to the
    ``entity_matches`` table.

    Args:
        source_registry: Slug of the registry providing the left-hand DataFrame.
        target_registry: Slug of the registry providing the right-hand DataFrame.
        db: Supabase client (injected by FastAPI dependency).

    Returns:
        Dict with match counts (confirmed, probable, possible) and upserted count.

    Raises:
        HTTPException 404: If either registry has no organisations.
        HTTPException 503: If the Supabase client is not configured or Splink fails.
    """
    logger.info(
        "resolve_entities_called",
        source_registry=source_registry,
        target_registry=target_registry,
    )

    orgs_a = _fetch_registry_orgs(db, source_registry)
    orgs_b = _fetch_registry_orgs(db, target_registry)

    logger.info(
        "resolve_entities_dataframes_ready",
        source_count=len(orgs_a),
        target_count=len(orgs_b),
    )

    try:
        matches = await resolve_entities(orgs_a, orgs_b)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("resolve_entities_splink_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Entity resolution failed: {exc}",
        ) from exc

    confirmed_count = int((matches["match_type"] == "confirmed").sum())
    probable_count = int((matches["match_type"] == "probable").sum())
    possible_count = int((matches["match_type"] == "possible").sum())

    try:
        upserted = await load_entity_matches(db, matches)
    except Exception as exc:
        logger.error("resolve_entities_load_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to persist entity matches: {exc}",
        ) from exc

    logger.info(
        "resolve_entities_complete",
        source_registry=source_registry,
        target_registry=target_registry,
        confirmed=confirmed_count,
        probable=probable_count,
        possible=possible_count,
        upserted=upserted,
    )

    return {
        "status": "ok",
        "source_registry": source_registry,
        "target_registry": target_registry,
        "confirmed_matches": confirmed_count,
        "probable_matches": probable_count,
        "possible_matches": possible_count,
        "upserted": upserted,
    }


@router.get("/network/{org_id}")
async def get_entity_network(
    org_id: str,
    depth: int = Query(
        2, ge=1, le=4, description="Traversal depth (hops) for network expansion"
    ),
    db: Any = Depends(_db_client),
) -> dict[str, Any]:
    """Return the entity relationship network centred on an organization.

    Queries ``entity_matches`` for all confirmed and probable matches that
    include ``org_id`` on either side, then recursively expands the graph up
    to ``depth`` hops.

    Args:
        org_id: UUID string for the focal organization.
        depth: Number of hops to traverse (1-4).
        db: Supabase client (injected by FastAPI dependency).

    Returns:
        Dict with ``nodes`` (list of org dicts) and ``edges`` (list of match
        dicts) suitable for ECharts / D3 graph rendering.

    Raises:
        HTTPException 503: If the Supabase client is not configured.
    """
    logger.info("get_entity_network_called", org_id=org_id, depth=depth)

    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []
    frontier: set[str] = {org_id}

    for _hop in range(depth):
        if not frontier:
            break

        next_frontier: set[str] = set()

        for focal_id in frontier:
            try:
                # Matches where this org appears on the left side
                resp_l = (
                    db.table("entity_matches")
                    .select("org_a_id,org_b_id,match_probability,match_type,matched_fields")
                    .eq("org_a_id", focal_id)
                    .in_("match_type", ["confirmed", "probable"])
                    .execute()
                )
                # Matches where this org appears on the right side
                resp_r = (
                    db.table("entity_matches")
                    .select("org_a_id,org_b_id,match_probability,match_type,matched_fields")
                    .eq("org_b_id", focal_id)
                    .in_("match_type", ["confirmed", "probable"])
                    .execute()
                )
            except Exception as exc:
                logger.error(
                    "get_entity_network_query_failed",
                    org_id=focal_id,
                    error=str(exc),
                )
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Failed to query entity matches: {exc}",
                ) from exc

            match_rows: list[dict[str, Any]] = (resp_l.data or []) + (resp_r.data or [])

            for row in match_rows:
                a_id: str = row["org_a_id"]
                b_id: str = row["org_b_id"]
                edge_key = f"{a_id}:{b_id}"

                # Deduplicate edges
                if not any(e.get("id") == edge_key for e in edges):
                    edges.append(
                        {
                            "id": edge_key,
                            "source": a_id,
                            "target": b_id,
                            "match_probability": row.get("match_probability"),
                            "match_type": row.get("match_type"),
                            "matched_fields": row.get("matched_fields"),
                        }
                    )

                # Queue unknown nodes for next hop
                for nid in (a_id, b_id):
                    if nid not in nodes:
                        nodes[nid] = {"id": nid}
                        next_frontier.add(nid)

        # Ensure the focal org itself is in the nodes dict
        if org_id not in nodes:
            nodes[org_id] = {"id": org_id}

        frontier = next_frontier - set(nodes.keys())

    # Enrich node metadata with org names if available
    if nodes:
        try:
            node_ids = list(nodes.keys())
            # Supabase .in_() filter accepts a list
            resp_orgs = (
                db.table("organizations")
                .select("id,name,slug,country_code,sector")
                .in_("id", node_ids)
                .execute()
            )
            for org in (resp_orgs.data or []):
                nid = org.get("id")
                if nid and nid in nodes:
                    nodes[nid].update(org)
        except Exception as exc:
            # Non-fatal — return bare node IDs if enrichment fails
            logger.warning("get_entity_network_enrich_failed", error=str(exc))

    logger.info(
        "get_entity_network_complete",
        org_id=org_id,
        node_count=len(nodes),
        edge_count=len(edges),
    )
    return {
        "org_id": org_id,
        "depth": depth,
        "nodes": list(nodes.values()),
        "edges": edges,
    }
