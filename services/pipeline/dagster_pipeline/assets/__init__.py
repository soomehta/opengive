from __future__ import annotations

from dagster_pipeline.assets.batch_scoring import batch_scoring
from dagster_pipeline.assets.india_scrapers import (
    fetch_gcc_directories,
    fetch_india_fcra,
    fetch_india_mca,
    fetch_india_ngo_darpan,
    load_gcc_directories,
    load_india_fcra,
    load_india_mca,
    load_india_ngo_darpan,
    normalize_gcc_directories,
    normalize_india_fcra,
    normalize_india_mca,
    normalize_india_ngo_darpan,
)
from dagster_pipeline.assets.uk_charity_commission import (
    fetch_uk_charity_commission,
    load_uk_charity_commission,
    normalize_uk_charity_commission,
)
from dagster_pipeline.assets.us_propublica import (
    fetch_propublica,
    load_propublica,
    normalize_propublica,
)

__all__ = [
    # ProPublica (US)
    "fetch_propublica",
    "normalize_propublica",
    "load_propublica",
    # UK Charity Commission
    "fetch_uk_charity_commission",
    "normalize_uk_charity_commission",
    "load_uk_charity_commission",
    # Sprint 5 — Scoring
    "batch_scoring",
    # Sprint 7 — India NGO Darpan
    "fetch_india_ngo_darpan",
    "normalize_india_ngo_darpan",
    "load_india_ngo_darpan",
    # Sprint 7 — India FCRA
    "fetch_india_fcra",
    "normalize_india_fcra",
    "load_india_fcra",
    # Sprint 7 — India MCA
    "fetch_india_mca",
    "normalize_india_mca",
    "load_india_mca",
    # Sprint 7 — GCC Directories
    "fetch_gcc_directories",
    "normalize_gcc_directories",
    "load_gcc_directories",
]
