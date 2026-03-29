from __future__ import annotations

import structlog
from supabase import Client, create_client

from app.config import settings

logger = structlog.get_logger()

_client: Client | None = None


def get_supabase_client() -> Client:
    """Return (or lazily create) the singleton Supabase client.

    Uses the service-role key so the ML API can bypass Row Level Security
    for internal read/write operations. Never expose this client or key to
    end-user-facing responses.

    Returns:
        Authenticated Supabase ``Client`` instance.

    Raises:
        RuntimeError: If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set.
    """
    global _client

    if _client is None:
        url = settings.supabase_url
        key = settings.supabase_service_role_key

        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set "
                "before the Supabase client can be initialised."
            )

        _client = create_client(url, key)
        logger.info("supabase_client_initialized", url=url[:30])

    return _client
