from __future__ import annotations

# ---------------------------------------------------------------------------
# India NGO Darpan Scrapy spider
#
# NGO Darpan is the Government of India's portal listing NGOs registered with
# the NITI Aayog. The public search interface at https://ngodarpan.gov.in
# exposes a paginated search endpoint that returns JSON results.
#
# Politeness: ROBOTSTXT_OBEY=True and DOWNLOAD_DELAY=2 are enforced globally
# via settings.py.  Do not lower these values per-spider.
# ---------------------------------------------------------------------------

import json
from typing import Any, Generator

import scrapy
import structlog
from scrapy.http import Response

from dagster_pipeline.utils.normalize import compute_content_hash, generate_slug

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REGISTRY_SOURCE = "in_ngo_darpan"
COUNTRY_CODE = "IN"

# NGO Darpan public search API endpoint.
# The portal uses an AJAX-powered search that accepts POST requests.
_SEARCH_URL = "https://ngodarpan.gov.in/index.php/ajaxcontroller/search_index_new"

# Number of results to request per page.
_PAGE_SIZE = 10

# Maximum pages to crawl in a single run (None = exhaustive).
# The registry contains ~300 000 NGOs; cap in dev/demo mode.
_MAX_PAGES: int | None = 50


def _extract_text(value: Any) -> str:
    """Safely convert a value to a stripped string.

    Args:
        value: Any value from the JSON payload.

    Returns:
        Stripped string, or empty string if value is None / falsy.
    """
    if value is None:
        return ""
    return str(value).strip()


class IndiaNgoDarpanSpider(scrapy.Spider):
    """Scrapy spider for the India NGO Darpan portal (ngodarpan.gov.in).

    Paginates through the AJAX search API to extract basic registration data
    for every NGO. The extracted items are dicts ready for pipeline
    normalization and upsert into the organizations table.

    Attributes:
        name: Scrapy spider identifier.
        allowed_domains: Restrict crawl to the NGO Darpan domain.
        registry_source: OpenGive registry identifier.
        country_code: ISO 3166-1 alpha-2 country code.
    """

    name: str = "india_ngo_darpan"
    allowed_domains: list[str] = ["ngodarpan.gov.in"]

    # Custom settings to supplement global settings.py values.
    custom_settings: dict[str, Any] = {
        # Each page is a fresh POST; keep the global 2 s floor.
        "DOWNLOAD_DELAY": 2,
        "ROBOTSTXT_OBEY": True,
    }

    def start_requests(self) -> Generator[scrapy.Request, None, None]:
        """Yield the first POST request to the NGO Darpan search API.

        Returns:
            Generator of Scrapy Request objects starting at page 1.
        """
        yield self._make_request(page=1)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _make_request(self, page: int) -> scrapy.Request:
        """Build a POST Request for the given page number.

        The NGO Darpan AJAX endpoint accepts form-encoded parameters:
            ``start``   - zero-based record offset
            ``length``  - number of records per page
            ``query``   - search query (empty = all NGOs)

        Args:
            page: 1-based page index.

        Returns:
            A Scrapy FormRequest targeting the search API.
        """
        offset = (page - 1) * _PAGE_SIZE
        return scrapy.FormRequest(
            url=_SEARCH_URL,
            formdata={
                "start": str(offset),
                "length": str(_PAGE_SIZE),
                "query": "",
                "state_id": "0",
                "district_id": "0",
                "sector_id": "0",
            },
            headers={
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://ngodarpan.gov.in/index.php/search/",
            },
            callback=self.parse,
            cb_kwargs={"page": page},
            errback=self._handle_error,
        )

    def _handle_error(self, failure: Any) -> None:
        """Log request failures without stopping the spider.

        Args:
            failure: Twisted Failure object from Scrapy.
        """
        logger.warning(
            "india_ngo_darpan_request_failed",
            url=failure.request.url,
            error=str(failure.value),
        )

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    def parse(
        self,
        response: Response,
        page: int = 1,
    ) -> Generator[dict[str, Any] | scrapy.Request, None, None]:
        """Parse a page of NGO Darpan search results and yield items or follow-on pages.

        The API returns JSON with keys:
            ``data``            - list of NGO objects
            ``recordsTotal``    - total number of matching records

        Args:
            response: Scrapy Response object.
            page: Current 1-based page index (from cb_kwargs).

        Yields:
            Dict items for each NGO, and a follow-on Request for the next page
            if more results remain and _MAX_PAGES has not been reached.
        """
        try:
            payload: dict[str, Any] = response.json()
        except Exception as exc:
            logger.warning(
                "india_ngo_darpan_json_parse_error",
                page=page,
                url=response.url,
                error=str(exc),
            )
            return

        records: list[dict[str, Any]] = payload.get("data", [])
        total: int = int(payload.get("recordsTotal", 0))

        logger.debug(
            "india_ngo_darpan_page_parsed",
            page=page,
            records_on_page=len(records),
            total=total,
        )

        for raw in records:
            item = self._map_record(raw)
            if item:
                yield item

        # Pagination: continue if there are more records and we haven't hit the cap.
        fetched_so_far = page * _PAGE_SIZE
        if fetched_so_far < total:
            if _MAX_PAGES is None or page < _MAX_PAGES:
                yield self._make_request(page=page + 1)
            else:
                logger.info(
                    "india_ngo_darpan_max_pages_reached",
                    max_pages=_MAX_PAGES,
                    total_available=total,
                )

    def _map_record(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        """Map a raw NGO Darpan JSON record to the OpenGive organization schema.

        NGO Darpan JSON field names (as observed in the public portal):
            ``ngo_id``          - internal portal ID
            ``ngo_name``        - organization name
            ``state_name``      - state
            ``district_name``   - district / city
            ``sectors``         - comma-separated sector labels
            ``registration_no`` - registration number issued by NGO Darpan
            ``mobile``          - contact phone
            ``email``           - contact email
            ``website``         - website URL
            ``unique_id``       - unique Darpan ID (preferred as registry_id)

        Args:
            raw: A single NGO record dict from the API payload.

        Returns:
            Normalized dict ready for pipeline ingestion, or None if the record
            lacks a usable identifier.
        """
        registry_id = (
            _extract_text(raw.get("unique_id"))
            or _extract_text(raw.get("registration_no"))
            or _extract_text(raw.get("ngo_id"))
        )
        if not registry_id:
            logger.warning("india_ngo_darpan_missing_id", raw=raw)
            return None

        name = (
            _extract_text(raw.get("ngo_name"))
            or _extract_text(raw.get("name"))
            or f"Unnamed NGO {registry_id}"
        )
        slug = generate_slug(name)

        state = _extract_text(raw.get("state_name") or raw.get("state"))
        city = _extract_text(
            raw.get("district_name") or raw.get("city") or raw.get("district")
        )
        sector = _extract_text(raw.get("sectors") or raw.get("sector"))
        phone = _extract_text(raw.get("mobile") or raw.get("phone"))
        email = _extract_text(raw.get("email"))
        website = _extract_text(raw.get("website")) or None

        content_hash = compute_content_hash(
            json.dumps(raw, sort_keys=True, default=str).encode()
        )

        return {
            # Identity
            "name": name,
            "slug": slug,
            # Classification
            "org_type": "ngo",
            "sector": sector or None,
            # Geography
            "country_code": COUNTRY_CODE,
            "state_province": state or None,
            "city": city or None,
            # Registry
            "registry_source": REGISTRY_SOURCE,
            "registry_id": registry_id,
            "status": "active",
            # Contact
            "phone": phone or None,
            "email": email or None,
            "website": website,
            # Internal
            "_content_hash": content_hash,
            "_raw": raw,
        }
