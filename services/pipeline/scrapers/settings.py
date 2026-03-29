from __future__ import annotations

# ---------------------------------------------------------------------------
# Scrapy settings for the OpenGive pipeline.
# All scrapers must honour these baseline constraints — do not override
# ROBOTSTXT_OBEY or reduce DOWNLOAD_DELAY below 2 seconds per-spider.
# ---------------------------------------------------------------------------

BOT_NAME = "opengive"
SPIDER_MODULES = ["scrapers.spiders"]
NEWSPIDER_MODULE = "scrapers.spiders"

# ---------------------------------------------------------------------------
# Politeness — mandatory project policy
# ---------------------------------------------------------------------------

# Always respect robots.txt directives.
ROBOTSTXT_OBEY = True

# Minimum 2-second delay between consecutive requests to the same domain.
DOWNLOAD_DELAY = 2

# Global and per-domain concurrency caps keep request rates reasonable.
CONCURRENT_REQUESTS = 4
CONCURRENT_REQUESTS_PER_DOMAIN = 2

# Auto-throttle adapts delay to server response times; floor is DOWNLOAD_DELAY.
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 2
AUTOTHROTTLE_MAX_DELAY = 10
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0

# ---------------------------------------------------------------------------
# Identity
# ---------------------------------------------------------------------------

USER_AGENT = "OpenGive/0.1 (+https://opengive.org) Scrapy"

# ---------------------------------------------------------------------------
# HTTP cache — speeds up development re-runs, disabled in production via env.
# ---------------------------------------------------------------------------

HTTPCACHE_ENABLED = False
HTTPCACHE_EXPIRATION_SECS = 86400  # 24 hours
HTTPCACHE_DIR = ".scrapy/httpcache"
HTTPCACHE_IGNORE_HTTP_CODES: list[int] = [500, 502, 503, 504, 522, 524, 408, 429]

# ---------------------------------------------------------------------------
# Item pipelines (populated in Sprint 2)
# ---------------------------------------------------------------------------

ITEM_PIPELINES: dict[str, int] = {}

# ---------------------------------------------------------------------------
# Feed exports
# ---------------------------------------------------------------------------

FEEDS: dict[str, object] = {}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOG_LEVEL = "INFO"
