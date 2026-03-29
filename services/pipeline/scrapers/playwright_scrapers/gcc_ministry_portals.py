from __future__ import annotations

# ---------------------------------------------------------------------------
# GCC Ministry Portal Playwright scraper (best-effort)
#
# Scrapes charity / NGO directories from Gulf Cooperation Council (GCC)
# ministry portals.  These portals are diverse in structure, may serve
# content primarily in Arabic, and are not guaranteed to expose stable
# machine-readable endpoints.
#
# Design decisions:
#   - ALL parsing failures are logged as warnings and swallowed.  The
#     scraper MUST NOT raise exceptions that would fail the wider pipeline.
#   - Arabic text is preserved as-is (Unicode strings); generate_slug
#     handles normalization to ASCII kebab-case.
#   - Minimum 2 s delay between every page load (project-wide policy).
#   - registry_source is always 'gcc_directories'.
# ---------------------------------------------------------------------------

import asyncio
import json
from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REGISTRY_SOURCE = "gcc_directories"

_PAGE_DELAY_SECONDS = 2.0
_USER_AGENT = "OpenGive/0.1 (+https://opengive.org) Playwright"

# Maximum pages per portal per run.
_MAX_PAGES_PER_PORTAL: int = 10


# ---------------------------------------------------------------------------
# Portal definitions
# ---------------------------------------------------------------------------


@dataclass
class GccPortal:
    """Metadata for a single GCC ministry portal target.

    Attributes:
        name: Human-readable portal name for logging.
        country_code: ISO 3166-1 alpha-2 country code.
        url: Entry-point URL for the portal.
        table_selector: CSS selector to locate the results table or list.
        next_page_selector: CSS selector for the "next page" control.
        name_col_index: Zero-based column index for organization name.
        reg_no_col_index: Zero-based column index for registration number.
        state_col_index: Zero-based column index for state / emirate.
        extra_selectors: Additional optional field index overrides.
    """

    name: str
    country_code: str
    url: str
    table_selector: str = "table"
    next_page_selector: str = "a:has-text('Next'), a:has-text('التالي')"
    name_col_index: int = 1
    reg_no_col_index: int = 0
    state_col_index: int = 2
    extra_selectors: dict[str, int] = field(default_factory=dict)


# Best-effort portal list — extend as new portals are onboarded.
_GCC_PORTALS: list[GccPortal] = [
    GccPortal(
        name="UAE Ministry of Community Development",
        country_code="AE",
        url="https://www.mocd.gov.ae/ar/services/register-npo.aspx",
        table_selector="table.ms-listviewtable, table",
        next_page_selector=(
            "a[title*='Next'], a:has-text('التالي'), "
            "td.ms-SPPageNextLink a"
        ),
        name_col_index=1,
        reg_no_col_index=0,
        state_col_index=2,
    ),
    GccPortal(
        name="Saudi Arabia Ministry of Human Resources — Charitable Societies",
        country_code="SA",
        url="https://hrsd.gov.sa/en/charity-societies",
        table_selector="table, .views-table",
        next_page_selector=(
            "a:has-text('Next'), a:has-text('التالي'), "
            "li.pager-next a"
        ),
        name_col_index=0,
        reg_no_col_index=1,
        state_col_index=2,
    ),
    GccPortal(
        name="Kuwait Ministry of Social Affairs — NGO Directory",
        country_code="KW",
        url="https://www.mosal.gov.kw/ar/NGO/Pages/default.aspx",
        table_selector="table",
        next_page_selector="a:has-text('التالي'), a:has-text('Next')",
        name_col_index=1,
        reg_no_col_index=0,
        state_col_index=2,
    ),
    GccPortal(
        name="Qatar Ministry of Social Development — NGO Directory",
        country_code="QA",
        url="https://www.msd.gov.qa/En/Services/Licensing/NGOs/Pages/default.aspx",
        table_selector="table",
        next_page_selector="a:has-text('Next'), a:has-text('التالي')",
        name_col_index=1,
        reg_no_col_index=0,
        state_col_index=2,
    ),
    GccPortal(
        name="Bahrain Ministry of Social Development — Charity Directory",
        country_code="BH",
        url="https://www.social.gov.bh/en/societies",
        table_selector="table, .society-list",
        next_page_selector="a:has-text('Next'), a:has-text('التالي')",
        name_col_index=0,
        reg_no_col_index=1,
        state_col_index=2,
    ),
    GccPortal(
        name="Oman Ministry of Social Development — NGO Registry",
        country_code="OM",
        url="https://www.mosd.gov.om/ar/organizations",
        table_selector="table",
        next_page_selector="a:has-text('التالي'), a:has-text('Next')",
        name_col_index=1,
        reg_no_col_index=0,
        state_col_index=2,
    ),
]


# ---------------------------------------------------------------------------
# Core scraping logic
# ---------------------------------------------------------------------------


async def scrape_gcc_portals(
    portals: list[GccPortal] | None = None,
    max_pages_per_portal: int = _MAX_PAGES_PER_PORTAL,
) -> list[dict[str, Any]]:
    """Scrape all configured GCC ministry portals using Playwright.

    Each portal is scraped independently; failures in one portal do NOT
    stop processing of others.  All parsing errors are logged as warnings.

    Args:
        portals: List of GccPortal configurations.  Defaults to
            ``_GCC_PORTALS``.
        max_pages_per_portal: Maximum result pages to scrape per portal.

    Returns:
        Flat list of normalized organization dicts from all portals.

    Raises:
        ImportError: If playwright is not installed.
    """
    try:
        from playwright.async_api import async_playwright  # noqa: PLC0415
    except ImportError as exc:
        raise ImportError(
            "playwright is required for the GCC scraper. "
            "Install it with: pip install playwright && playwright install chromium"
        ) from exc

    if portals is None:
        portals = _GCC_PORTALS

    all_records: list[dict[str, Any]] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        for portal in portals:
            try:
                records = await _scrape_single_portal(
                    browser=browser,
                    portal=portal,
                    max_pages=max_pages_per_portal,
                )
                all_records.extend(records)
                logger.info(
                    "gcc_portal_scraped",
                    portal=portal.name,
                    country=portal.country_code,
                    records=len(records),
                )
            except Exception as exc:
                # Best-effort: log warning and continue with remaining portals.
                logger.warning(
                    "gcc_portal_failed",
                    portal=portal.name,
                    country=portal.country_code,
                    error=str(exc),
                )

        await browser.close()

    logger.info("gcc_all_portals_complete", total_records=len(all_records))
    return all_records


async def _scrape_single_portal(
    browser: Any,
    portal: GccPortal,
    max_pages: int,
) -> list[dict[str, Any]]:
    """Scrape a single GCC portal, paginating up to ``max_pages`` pages.

    Args:
        browser: Playwright Browser instance.
        portal: Portal configuration.
        max_pages: Maximum pages to scrape from this portal.

    Returns:
        List of organization dicts extracted from the portal.
    """
    records: list[dict[str, Any]] = []
    context = await browser.new_context(user_agent=_USER_AGENT)
    page = await context.new_page()

    # Block images and stylesheets for speed.
    await page.route(
        "**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}",
        lambda route: route.abort(),
    )

    try:
        logger.info("gcc_navigating", portal=portal.name, url=portal.url)
        await asyncio.sleep(_PAGE_DELAY_SECONDS)
        await page.goto(portal.url, wait_until="domcontentloaded", timeout=60_000)

        current_page = 1

        while True:
            await asyncio.sleep(_PAGE_DELAY_SECONDS)

            page_records = await _extract_portal_rows(page, portal)
            records.extend(page_records)

            logger.debug(
                "gcc_portal_page_scraped",
                portal=portal.name,
                page=current_page,
                records_on_page=len(page_records),
            )

            if not page_records:
                break

            if current_page >= max_pages:
                logger.info(
                    "gcc_portal_max_pages_reached",
                    portal=portal.name,
                    max_pages=max_pages,
                )
                break

            advanced = await _click_next_page(page, portal.next_page_selector)
            if not advanced:
                logger.info(
                    "gcc_portal_pagination_exhausted",
                    portal=portal.name,
                    pages_scraped=current_page,
                )
                break

            current_page += 1

    except Exception as exc:
        logger.warning(
            "gcc_single_portal_error",
            portal=portal.name,
            error=str(exc),
        )
        # Re-raise so the caller can log and continue with other portals.
        raise
    finally:
        await context.close()

    return records


async def _extract_portal_rows(
    page: Any,
    portal: GccPortal,
) -> list[dict[str, Any]]:
    """Extract organization rows from the table on the current portal page.

    Args:
        page: Playwright Page object on the portal results page.
        portal: GccPortal configuration with column index metadata.

    Returns:
        List of normalized record dicts.  Returns empty list on any parse
        failure (never raises).
    """
    from dagster_pipeline.utils.normalize import compute_content_hash, generate_slug  # noqa: PLC0415

    records: list[dict[str, Any]] = []

    try:
        table = page.locator(portal.table_selector).first
        if await table.count() == 0:
            logger.warning(
                "gcc_table_not_found",
                portal=portal.name,
                selector=portal.table_selector,
            )
            return records

        rows = await table.locator("tr").all()

        for row in rows:
            try:
                cells = await row.locator("td").all()
                if not cells:
                    continue

                cell_texts: list[str] = []
                for cell in cells:
                    raw_text = await cell.inner_text()
                    cell_texts.append(str(raw_text).strip())

                # Safe column extraction with index bounds check.
                def _col(idx: int) -> str:
                    return cell_texts[idx] if 0 <= idx < len(cell_texts) else ""

                name = _col(portal.name_col_index)
                reg_no = _col(portal.reg_no_col_index)
                state = _col(portal.state_col_index)

                if not name:
                    continue

                # Use reg_no if present; fall back to slugged name as a
                # best-effort synthetic identifier.
                registry_id = reg_no or f"gcc-{generate_slug(name)}"

                raw: dict[str, Any] = {
                    "name": name,
                    "reg_no": reg_no,
                    "state": state,
                    "portal": portal.name,
                    "country_code": portal.country_code,
                    "all_cells": cell_texts,
                }

                content_hash = compute_content_hash(
                    json.dumps(raw, sort_keys=True, default=str).encode()
                )

                record: dict[str, Any] = {
                    "name": name,
                    "slug": generate_slug(name),
                    "org_type": "ngo",
                    "country_code": portal.country_code,
                    "state_province": state or None,
                    "registry_source": REGISTRY_SOURCE,
                    "registry_id": registry_id,
                    "status": "active",
                    "_content_hash": content_hash,
                    "_raw": raw,
                }
                records.append(record)

            except Exception as row_exc:
                # Row-level failure: log warning and skip the row.
                logger.warning(
                    "gcc_row_parse_warning",
                    portal=portal.name,
                    error=str(row_exc),
                )

    except Exception as exc:
        # Table-level failure: log warning and return what we have.
        logger.warning(
            "gcc_table_parse_warning",
            portal=portal.name,
            error=str(exc),
        )

    return records


async def _click_next_page(page: Any, next_selector: str) -> bool:
    """Attempt to navigate to the next page using the provided CSS selector.

    Args:
        page: Playwright Page object on the current results page.
        next_selector: CSS / text selector for the "next page" control.

    Returns:
        True if navigation was triggered, False if no control was found.
    """
    try:
        next_el = page.locator(next_selector).first
        if await next_el.count() == 0:
            return False
        if not await next_el.is_visible():
            return False
        await next_el.click()
        await page.wait_for_load_state("domcontentloaded", timeout=30_000)
        return True
    except Exception as exc:
        logger.warning("gcc_next_page_click_warning", error=str(exc))
        return False


# ---------------------------------------------------------------------------
# Synchronous entry-point (used by Dagster asset)
# ---------------------------------------------------------------------------


def run_gcc_scraper(
    max_pages_per_portal: int = _MAX_PAGES_PER_PORTAL,
) -> list[dict[str, Any]]:
    """Run the GCC Playwright scraper synchronously.

    Convenience wrapper around ``scrape_gcc_portals`` for use from
    synchronous Dagster asset functions.

    Args:
        max_pages_per_portal: Maximum result pages per portal.

    Returns:
        List of normalized organization dicts.
    """
    return asyncio.run(scrape_gcc_portals(max_pages_per_portal=max_pages_per_portal))
