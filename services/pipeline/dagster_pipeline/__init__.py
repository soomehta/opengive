from __future__ import annotations

from dagster import Definitions, load_assets_from_modules

from dagster_pipeline.assets import (
    australia_acnc,
    batch_anomaly_detection,
    batch_embeddings,
    batch_entity_resolution,
    batch_scoring,
    canada_cra,
    france_rna,
    iati,
    india_scrapers,
    oecd_dac,
    uk_360giving,
    uk_charity_commission,
    unocha_fts,
    us_propublica,
)
from dagster_pipeline.resources.supabase import SupabaseResource

# ---------------------------------------------------------------------------
# Asset discovery
# Load all assets from each source module so that adding a new module only
# requires importing it here.
# ---------------------------------------------------------------------------
_all_assets = load_assets_from_modules(
    [
        # Sprint 1-2 (Phase 1)
        us_propublica,
        uk_charity_commission,
        # Sprint 3
        uk_360giving,
        iati,
        # Sprint 4
        canada_cra,
        australia_acnc,
        france_rna,
        unocha_fts,
        oecd_dac,
        # Sprint 5 — scoring
        batch_scoring,
        # Sprint 5 — anomaly detection
        batch_anomaly_detection,
        # Sprint 5 — embeddings
        batch_embeddings,
        # Sprint 5 — entity resolution
        batch_entity_resolution,
        # Sprint 7 — India and GCC sources
        india_scrapers,
    ]
)

# ---------------------------------------------------------------------------
# Dagster Definitions — the single entry-point for `dagster dev` and
# deployment on Railway.
# ---------------------------------------------------------------------------
defs = Definitions(
    assets=list(_all_assets),
    resources={
        "supabase": SupabaseResource(),
    },
    jobs=[],
    schedules=[],
)
