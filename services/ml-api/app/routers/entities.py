from __future__ import annotations

from fastapi import APIRouter, Query
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/entities", tags=["entities"])


@router.post("/resolve")
async def resolve_entities(
    source_registry: str = Query(..., description="Source registry slug (e.g. 'us-irs', 'uk-ccew')"),
    target_registry: str = Query(..., description="Target registry slug to match against"),
) -> dict[str, str]:
    """Run Splink probabilistic entity resolution between two registry datasets.

    Loads organization records from both registries, executes the Splink
    DuckDB linker with trained parameters, classifies matches as confirmed /
    probable / possible, and persists results to the `entity_matches` table.
    Full implementation uses app.services.splink_resolver.resolve_entities().

    Args:
        source_registry: Slug of the registry providing the left-hand DataFrame.
        target_registry: Slug of the registry providing the right-hand DataFrame.

    Returns:
        Placeholder status dict until Splink resolver is fully wired.
    """
    logger.info(
        "resolve_entities_called",
        source_registry=source_registry,
        target_registry=target_registry,
    )
    # Sprint 4 / 5: pull org DataFrames from Supabase, call
    # splink_resolver.resolve_entities(), then load_entity_matches().
    return {
        "status": "not_implemented",
        "source_registry": source_registry,
        "target_registry": target_registry,
    }


@router.get("/network/{org_id}")
async def get_entity_network(
    org_id: str,
    depth: int = Query(2, ge=1, le=4, description="Traversal depth (hops) for network expansion"),
) -> dict[str, str]:
    """Return the entity relationship network centred on an organization.

    Traverses confirmed and probable entity matches, shared directors, and
    shared addresses up to `depth` hops to build a graph suitable for the
    frontend network visualisation. Full implementation in Sprint 5.

    Args:
        org_id: UUID string for the focal organization.
        depth: Number of hops to traverse (1–4).

    Returns:
        Placeholder status dict until network traversal is implemented.
    """
    logger.info("get_entity_network_called", org_id=org_id, depth=depth)
    # Sprint 5: query entity_matches + organization_relationships tables,
    # build adjacency list, return nodes/edges for d3/echarts graph.
    return {"status": "not_implemented", "org_id": org_id, "depth": str(depth)}
