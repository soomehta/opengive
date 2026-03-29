from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide configuration loaded from environment variables.

    All thresholds are documented in apps/docs/docs/methodology.md and
    can be overridden at deploy time without code changes.
    """

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Auth
    ml_api_secret: str = ""

    # AI providers
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Entity resolution thresholds
    entity_match_confirmed_threshold: float = 0.85
    entity_match_probable_threshold: float = 0.65

    # Anomaly detection thresholds
    benford_p_value_threshold: float = 0.01
    overhead_flip_threshold: float = 0.20  # 20 percentage-point swing
    revenue_cliff_threshold: float = 0.50  # 50% YoY decline
    zero_fundraising_contributions_min: float = 500_000.0
    shell_shared_address_min: int = 3
    shell_shared_director_min: int = 2
    compensation_outlier_revenue_max: float = 5_000_000.0
    compensation_outlier_peer_multiplier: float = 2.0

    # Scoring thresholds (used by scoring.py pillar calculations)
    scoring_program_expense_ratio_benchmark: float = 0.75  # >75% is excellent
    scoring_fundraising_efficiency_benchmark: float = 0.25  # <$0.25 per $1 raised
    scoring_admin_expense_ratio_benchmark: float = 0.15     # <15% is excellent
    scoring_cash_reserve_months_benchmark: float = 6.0      # >=6 months is excellent
    scoring_board_size_min: int = 5
    scoring_board_size_max: int = 25
    scoring_methodology_version: str = "v1"

    # Embedding model
    embedding_model: str = "text-embedding-3-small"
    embedding_dims: int = 1536

    # Splink training
    splink_random_sampling_max_pairs: float = 1e6

    model_config = SettingsConfigDict(env_prefix="", case_sensitive=False)


settings = Settings()
