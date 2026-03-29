from __future__ import annotations

from typing import TYPE_CHECKING

import pandas as pd
import structlog
from splink import DuckDBAPI, Linker, SettingsCreator, block_on
from splink import comparison_library as cl

from app.config import settings

if TYPE_CHECKING:
    from supabase import Client

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Splink settings
# ---------------------------------------------------------------------------
# Comparisons mirror the fields present in the `organizations` table:
#   name, country_code, city, registration_id
#
# Blocking rules narrow the candidate pairs space before full comparison:
#   - Same country_code  (mandatory — cross-country matches use a separate pass)
#   - Same city          (coarser pass to catch address variants)
#
# Thresholds (confirmed / probable) are pulled from settings so they can be
# tuned via env vars without touching source code.
# ---------------------------------------------------------------------------

SPLINK_SETTINGS = SettingsCreator(
    link_type="link_only",
    comparisons=[
        cl.JaroWinklerAtThresholds("name", [0.9, 0.8, 0.7]),
        cl.ExactMatch("country_code").configure(term_frequency_adjustments=True),
        cl.JaroWinklerAtThresholds("city", [0.85, 0.7]),
        cl.ExactMatch("registration_id").configure(
            label_for_charts="Registration ID exact match"
        ),
    ],
    blocking_rules_to_generate_predictions=[
        block_on("country_code"),
        block_on("city"),
    ],
    retain_matching_columns=True,
    retain_intermediate_calculation_columns=False,
)

# Columns required in both input DataFrames
REQUIRED_COLUMNS: frozenset[str] = frozenset(
    {"unique_id", "name", "country_code", "city", "registration_id"}
)


def _validate_dataframe(df: pd.DataFrame, label: str) -> None:
    """Raise ValueError if required columns are absent.

    Args:
        df: DataFrame to validate.
        label: Human-readable label used in the error message.

    Raises:
        ValueError: When one or more required columns are missing.
    """
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(
            f"DataFrame '{label}' is missing required columns: {sorted(missing)}"
        )


async def resolve_entities(
    orgs_a: pd.DataFrame,
    orgs_b: pd.DataFrame,
    confirmed_threshold: float | None = None,
    probable_threshold: float | None = None,
) -> pd.DataFrame:
    """Run Splink entity resolution between two sets of organizations.

    Trains a DuckDB-backed Splink model using expectation-maximisation and
    random-sampling u-probability estimation, then classifies each match pair
    as ``confirmed``, ``probable``, or ``possible``.

    The function is declared ``async`` so it integrates cleanly with FastAPI
    endpoints, but Splink's DuckDB backend is synchronous. For large datasets
    consider offloading to a thread pool via ``asyncio.to_thread``.

    Args:
        orgs_a: Left-hand organization DataFrame. Must contain
            ``unique_id``, ``name``, ``country_code``, ``city``,
            ``registration_id`` columns.
        orgs_b: Right-hand organization DataFrame with the same schema.
        confirmed_threshold: Match probability above which a pair is
            classified as *confirmed*. Defaults to
            ``settings.entity_match_confirmed_threshold``.
        probable_threshold: Match probability above which a pair is
            classified as *probable*. Defaults to
            ``settings.entity_match_probable_threshold``.

    Returns:
        DataFrame with columns:
        ``unique_id_l``, ``unique_id_r``, ``match_probability``,
        ``match_type``, plus any retained matching columns from Splink.

    Raises:
        ValueError: If either DataFrame is missing required columns or is
            empty.
    """
    _validate_dataframe(orgs_a, "orgs_a")
    _validate_dataframe(orgs_b, "orgs_b")

    if orgs_a.empty or orgs_b.empty:
        raise ValueError("Both input DataFrames must be non-empty.")

    confirmed_threshold = confirmed_threshold or settings.entity_match_confirmed_threshold
    probable_threshold = probable_threshold or settings.entity_match_probable_threshold

    logger.info(
        "entity_resolution_started",
        orgs_a_count=len(orgs_a),
        orgs_b_count=len(orgs_b),
        confirmed_threshold=confirmed_threshold,
        probable_threshold=probable_threshold,
    )

    db_api = DuckDBAPI()
    linker = Linker([orgs_a, orgs_b], SPLINK_SETTINGS, db_api)

    # --- Training phase ---
    linker.training.estimate_u_using_random_sampling(
        max_pairs=settings.splink_random_sampling_max_pairs
    )
    linker.training.estimate_parameters_using_expectation_maximisation(
        block_on("name"),
        estimate_without_term_frequencies=True,
    )

    # --- Prediction phase ---
    predictions = linker.inference.predict(
        threshold_match_probability=probable_threshold
    )
    results: pd.DataFrame = predictions.as_pandas_dataframe()

    # --- Classification ---
    def _classify(prob: float) -> str:
        if prob >= confirmed_threshold:
            return "confirmed"
        if prob >= probable_threshold:
            return "probable"
        return "possible"

    results["match_type"] = results["match_probability"].apply(_classify)

    confirmed_count = int((results["match_type"] == "confirmed").sum())
    probable_count = int((results["match_type"] == "probable").sum())
    possible_count = int((results["match_type"] == "possible").sum())

    logger.info(
        "entity_resolution_complete",
        total_matches=len(results),
        confirmed=confirmed_count,
        probable=probable_count,
        possible=possible_count,
    )

    return results


async def load_entity_matches(client: "Client", matches: pd.DataFrame) -> int:
    """Upsert entity match results into the ``entity_matches`` Supabase table.

    Converts the Splink results DataFrame into records compatible with the
    ``entity_matches`` schema and performs an upsert so that re-running
    resolution is idempotent.

    The ``entity_matches`` table is expected to have at minimum:
    ``org_a_id``, ``org_b_id``, ``match_probability``, ``match_type``,
    ``matched_fields`` (jsonb), with a unique constraint on
    ``(org_a_id, org_b_id)``.

    Args:
        client: Authenticated Supabase client (service role).
        matches: DataFrame returned by :func:`resolve_entities`.

    Returns:
        Number of rows upserted.

    Raises:
        ValueError: If required columns are absent from ``matches``.
        RuntimeError: If the Supabase upsert fails.
    """
    required = {"unique_id_l", "unique_id_r", "match_probability", "match_type"}
    missing = required - set(matches.columns)
    if missing:
        raise ValueError(
            f"matches DataFrame is missing columns: {sorted(missing)}"
        )

    if matches.empty:
        logger.info("load_entity_matches_skipped", reason="empty_dataframe")
        return 0

    # Build matched_fields list from retained Splink comparison columns
    comparison_cols = [
        c for c in matches.columns
        if c.endswith(("_l", "_r"))
        and c not in {"unique_id_l", "unique_id_r"}
    ]

    records = [
        {
            "org_a_id": row["unique_id_l"],
            "org_b_id": row["unique_id_r"],
            "match_probability": float(row["match_probability"]),
            "match_type": row["match_type"],
            "matched_fields": {
                col.removesuffix("_l"): {
                    "left": row.get(col),
                    "right": row.get(col.removesuffix("_l") + "_r"),
                }
                for col in comparison_cols
                if col.endswith("_l")
            },
        }
        for _, row in matches.iterrows()
    ]

    response = (
        client.table("entity_matches")
        .upsert(records, on_conflict="org_a_id,org_b_id")
        .execute()
    )

    upserted = len(response.data) if response.data else 0
    logger.info("entity_matches_upserted", count=upserted)
    return upserted
