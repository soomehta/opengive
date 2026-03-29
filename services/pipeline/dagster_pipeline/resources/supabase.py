from __future__ import annotations

import os

import structlog
from dagster import ConfigurableResource
from supabase import Client, create_client

logger = structlog.get_logger()


class SupabaseResource(ConfigurableResource):
    """Dagster configurable resource for Supabase client access.

    Reads connection parameters from environment variables by default.
    Can be overridden via Dagster's resource configuration system.

    Attributes:
        url: Supabase project URL.
        service_role_key: Supabase service role key for elevated access.
    """

    url: str = os.environ.get("SUPABASE_URL", "")
    service_role_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    def get_client(self) -> Client:
        """Create and return an authenticated Supabase client.

        Returns:
            A Supabase Client instance authenticated with the service role key.
        """
        logger.info("creating_supabase_client", url=self.url)
        return create_client(self.url, self.service_role_key)
