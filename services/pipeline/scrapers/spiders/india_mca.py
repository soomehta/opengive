from __future__ import annotations

# ---------------------------------------------------------------------------
# India MCA (Ministry of Corporate Affairs) Scrapy spider
#
# The MCA21 portal lists Section 8 companies — the Indian Companies Act
# category for non-profit companies pursuing charitable or public-interest
# objectives.  The MCA provides a public data API at
# https://www.mca.gov.in/mcafoportal/viewSignatoryDetails.do and a
# company-search endpoint that returns JSON.
#
# Politeness: ROBOTSTXT_OBEY=True and DOWNLOAD_DELAY=2 are enforced globally
# via settings.py.  Do not lower these values per-spider.
# ---------------------------------------------------------------------------

import json
from typing import Any, Generator
from urllib.parse import urlencode

import scrapy
import structlog
from scrapy.http import Response

from dagster_pipeline.utils.normalize import compute_content_hash, generate_slug

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REGISTRY_SOURCE = "in_mca"
COUNTRY_CODE = "IN"

# MCA company search endpoint (public, no auth required for basic search).
# Returns JSON with company name, CIN, and registration metadata.
_SEARCH_BASE = "https://www.mca.gov.in/mcafoportal/showCheckCompanyname.do"

# The MCA company master data API provides bulk access (updated monthly).
# We target the JSON endpoint for Section 8 company type filter.
_COMPANY_SEARCH_URL = (
    "https://www.mca.gov.in/mcafoportal/getCompanyMasterData.do"
)

# Section 8 company class code used by MCA.
_SECTION8_CLASS = "Section 8"

# Number of results per page.
_PAGE_SIZE = 50

# Maximum pages to crawl per run (None = exhaustive).
_MAX_PAGES: int | None = 20


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


class IndiaMcaSpider(scrapy.Spider):
    """Scrapy spider for India MCA Section 8 (non-profit) companies.

    Paginates through the MCA company search API filtering for Section 8
    company class.  The extracted items are dicts ready for pipeline
    normalization and upsert into the organizations table.

    Attributes:
        name: Scrapy spider identifier.
        allowed_domains: Restrict crawl to the MCA domain.
        registry_source: OpenGive registry identifier.
        country_code: ISO 3166-1 alpha-2 country code.
    """

    name: str = "india_mca"
    allowed_domains: list[str] = ["mca.gov.in"]

    custom_settings: dict[str, Any] = {
        "DOWNLOAD_DELAY": 2,
        "ROBOTSTXT_OBEY": True,
    }

    def start_requests(self) -> Generator[scrapy.Request, None, None]:
        """Yield the first GET request targeting MCA Section 8 companies.

        Returns:
            Generator of Scrapy Request objects starting at page 1.
        """
        yield self._make_request(page=1)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _make_request(self, page: int) -> scrapy.Request:
        """Build a GET Request for MCA company master data at a given page.

        Args:
            page: 1-based page index.

        Returns:
            A Scrapy Request for the MCA company search endpoint.
        """
        params = {
            "companyClass": _SECTION8_CLASS,
            "page": str(page),
            "size": str(_PAGE_SIZE),
        }
        url = f"{_COMPANY_SEARCH_URL}?{urlencode(params)}"
        return scrapy.Request(
            url=url,
            headers={
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do",
                "User-Agent": "OpenGive/0.1 (+https://opengive.org) Scrapy",
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
            "india_mca_request_failed",
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
        """Parse a page of MCA company results and yield items or follow-on pages.

        The MCA JSON response structure (observed from the portal):
            ``data``           - list of company objects
            ``totalCount``     - total matching companies

        Each company object includes:
            ``CIN``                    - Corporate Identification Number
            ``COMPANY_NAME``           - legal name
            ``COMPANY_STATUS``         - registration status
            ``STATE``                  - state of incorporation
            ``REGISTERED_OFFICE_ADDRESS`` - registered address string
            ``DATE_OF_INCORPORATION``  - ISO date string
            ``COMPANY_CLASS``          - "Section 8" etc.
            ``COMPANY_CATEGORY``       - sub-category

        Args:
            response: Scrapy Response object.
            page: Current 1-based page index (from cb_kwargs).

        Yields:
            Dict items for each company, and a follow-on Request for the next
            page if more results remain and _MAX_PAGES has not been reached.
        """
        try:
            payload: dict[str, Any] = response.json()
        except Exception as exc:
            logger.warning(
                "india_mca_json_parse_error",
                page=page,
                url=response.url,
                error=str(exc),
            )
            return

        records: list[dict[str, Any]] = (
            payload.get("data")
            or payload.get("companies")
            or payload.get("results")
            or []
        )
        total: int = int(
            payload.get("totalCount", payload.get("total", 0))
        )

        logger.debug(
            "india_mca_page_parsed",
            page=page,
            records_on_page=len(records),
            total=total,
        )

        for raw in records:
            item = self._map_record(raw)
            if item:
                yield item

        fetched_so_far = page * _PAGE_SIZE
        if fetched_so_far < total:
            if _MAX_PAGES is None or page < _MAX_PAGES:
                yield self._make_request(page=page + 1)
            else:
                logger.info(
                    "india_mca_max_pages_reached",
                    max_pages=_MAX_PAGES,
                    total_available=total,
                )

    def _map_record(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        """Map a raw MCA company JSON record to the OpenGive organization schema.

        Args:
            raw: A single company record dict from the API payload.

        Returns:
            Normalized dict ready for pipeline ingestion, or None if the
            record lacks a usable CIN identifier.
        """
        registry_id = (
            _extract_text(raw.get("CIN"))
            or _extract_text(raw.get("cin"))
            or _extract_text(raw.get("company_cin"))
        )
        if not registry_id:
            logger.warning("india_mca_missing_cin", raw=raw)
            return None

        name = (
            _extract_text(raw.get("COMPANY_NAME"))
            or _extract_text(raw.get("company_name"))
            or f"Unnamed MCA Company {registry_id}"
        )
        slug = generate_slug(name)

        state = _extract_text(
            raw.get("STATE") or raw.get("state") or raw.get("state_of_incorporation")
        )
        address = _extract_text(
            raw.get("REGISTERED_OFFICE_ADDRESS") or raw.get("address")
        )

        registration_date: str | None = (
            _extract_text(
                raw.get("DATE_OF_INCORPORATION")
                or raw.get("date_of_incorporation")
                or raw.get("registration_date")
            )
            or None
        )

        raw_status = _extract_text(
            raw.get("COMPANY_STATUS") or raw.get("company_status") or raw.get("status")
        ).lower()
        if raw_status in {"active", "registered"}:
            status = "active"
        elif raw_status in {"struck off", "dissolved", "liquidated"}:
            status = "dissolved"
        elif raw_status in {"under process of striking off", "suspended"}:
            status = "suspended"
        else:
            status = "active"

        content_hash = compute_content_hash(
            json.dumps(raw, sort_keys=True, default=str).encode()
        )

        return {
            # Identity
            "name": name,
            "slug": slug,
            # Classification — Section 8 companies are nonprofits by definition
            "org_type": "nonprofit",
            # Geography
            "country_code": COUNTRY_CODE,
            "state_province": state or None,
            "address_line1": address or None,
            # Registry
            "registry_source": REGISTRY_SOURCE,
            "registry_id": registry_id,
            "registration_date": registration_date,
            "status": status,
            # Internal
            "_content_hash": content_hash,
            "_raw": raw,
        }
