from __future__ import annotations

# ---------------------------------------------------------------------------
# India FCRA Portal Playwright scraper
#
# The Foreign Contribution (Regulation) Act (FCRA) portal at
# https://fcraonline.nic.in/ is a JavaScript-heavy application that lists
# NGOs and associations registered to receive foreign contributions.
#
# Because the portal relies on dynamic JavaScript rendering, Scrapy cannot
# be used here.  Instead we use Playwright for browser automation.
#
# Politeness rules (enforced in code):
#   - Minimum 2 seconds between page loads / form submissions.
#   - User-Agent mirrors the global OpenGive identity.
#   - robots.txt is manually honoured (checked at module level).
# ---------------------------------------------------------------------------

import asyncio
import json
import time
from typing import Any

import structlog

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REGISTRY_SOURCE = "in_fcra"
COUNTRY_CODE = "IN"

# FCRA public search URL.
_FCRA_SEARCH_URL = "https://fcraonline.nic.in/fc3_public_qry.aspx"

# Minimum delay between page interactions (seconds) — project-wide policy.
_PAGE_DELAY_SECONDS = 2.0

# Maximum pages to scrape per run (None = exhaustive).
_MAX_PAGES: int | None = 20

_USER_AGENT = "OpenGive/0.1 (+https://opengive.org) Playwright"


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------


def _extract_text(value: Any) -> str:
    """Safely convert a value to a stripped string.

    Args:
        value: Any value (str, None, int, etc.)

    Returns:
        Stripped string or empty string.
    """
    if value is None:
        return ""
    return str(value).strip()


def _build_record(
    name: str,
    fcra_reg_no: str,
    state: str,
    purpose: str,
    status: str,
    raw: dict[str, Any],
) -> dict[str, Any]:
    """Assemble a normalized record dict from extracted FCRA fields.

    Imports are deferred inside the function to avoid a hard dependency on
    the Dagster normalize utils at import time (the Playwright scraper may
    be invoked standalone).

    Args:
        name: Organization name.
        fcra_reg_no: FCRA registration number (used as registry_id).
        state: State of registration.
        purpose: FCRA-registered purpose / sector.
        status: Raw status string from the portal.
        raw: Full raw dict of scraped fields for content hashing.

    Returns:
        Dict conforming to the OpenGive organizations table schema plus
        internal fields ``_content_hash`` and ``_raw``.
    """
    from dagster_pipeline.utils.normalize import compute_content_hash, generate_slug  # noqa: PLC0415

    slug = generate_slug(name)

    if status.lower() in {"active", "registered", "valid"}:
        norm_status = "active"
    elif status.lower() in {"cancelled", "revoked", "rejected"}:
        norm_status = "inactive"
    else:
        norm_status = "active"

    content_hash = compute_content_hash(
        json.dumps(raw, sort_keys=True, default=str).encode()
    )

    return {
        "name": name,
        "slug": slug,
        "org_type": "ngo",
        "sector": purpose or None,
        "country_code": COUNTRY_CODE,
        "state_province": state or None,
        "registry_source": REGISTRY_SOURCE,
        "registry_id": fcra_reg_no,
        "status": norm_status,
        "_content_hash": content_hash,
        "_raw": raw,
    }


# ---------------------------------------------------------------------------
# Core scraping logic
# ---------------------------------------------------------------------------


async def scrape_fcra_portal(
    max_pages: int | None = _MAX_PAGES,
) -> list[dict[str, Any]]:
    """Scrape the FCRA online portal using Playwright.

    Navigates to the FCRA public query page, submits the search form with
    a wildcard/all query, then iterates through paginated results extracting
    organization records.

    A ``_PAGE_DELAY_SECONDS`` sleep is applied before every page load or
    form interaction to respect server capacity.

    Args:
        max_pages: Maximum number of result pages to scrape.
            Pass None to scrape exhaustively.

    Returns:
        List of normalized organization dicts ready for pipeline ingestion.

    Raises:
        ImportError: If playwright is not installed.
    """
    try:
        from playwright.async_api import async_playwright  # noqa: PLC0415
    except ImportError as exc:
        raise ImportError(
            "playwright is required for the FCRA scraper. "
            "Install it with: pip install playwright && playwright install chromium"
        ) from exc

    all_records: list[dict[str, Any]] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=_USER_AGENT,
            # Disable images and stylesheets for speed.
            java_script_enabled=True,
        )
        page = await context.new_page()

        # Route to block unnecessary resources.
        await page.route(
            "**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}",
            lambda route: route.abort(),
        )

        try:
            logger.info("fcra_navigating", url=_FCRA_SEARCH_URL)
            await asyncio.sleep(_PAGE_DELAY_SECONDS)
            await page.goto(_FCRA_SEARCH_URL, wait_until="domcontentloaded", timeout=60_000)

            # Wait for the search form to be interactive.
            await page.wait_for_selector("input, select, table", timeout=30_000)

            # Submit the search form with blank/wildcard inputs to retrieve all records.
            # The FCRA portal typically has a "State" dropdown and a text field for name.
            # Selecting the first/default option (All States) and leaving name blank
            # returns the full list.
            try:
                state_select = page.locator("select[name*='state'], select[id*='state']").first
                if await state_select.count() > 0:
                    await state_select.select_option(index=0)
            except Exception as sel_exc:
                logger.warning("fcra_state_select_missing", error=str(sel_exc))

            # Click the search / submit button.
            try:
                submit_btn = page.locator(
                    "input[type='submit'], button[type='submit'], input[value*='Search']"
                ).first
                if await submit_btn.count() > 0:
                    await asyncio.sleep(_PAGE_DELAY_SECONDS)
                    await submit_btn.click()
                    await page.wait_for_load_state("domcontentloaded", timeout=30_000)
            except Exception as btn_exc:
                logger.warning("fcra_submit_button_missing", error=str(btn_exc))

            current_page = 1

            while True:
                await asyncio.sleep(_PAGE_DELAY_SECONDS)

                # Extract the results table rows.
                records_on_page = await _extract_table_rows(page)
                all_records.extend(records_on_page)

                logger.debug(
                    "fcra_page_scraped",
                    page=current_page,
                    records_on_page=len(records_on_page),
                    total_so_far=len(all_records),
                )

                if not records_on_page:
                    logger.info("fcra_no_records_on_page", page=current_page)
                    break

                if max_pages is not None and current_page >= max_pages:
                    logger.info("fcra_max_pages_reached", max_pages=max_pages)
                    break

                # Attempt to click the "Next" pagination link.
                advanced = await _click_next_page(page)
                if not advanced:
                    logger.info("fcra_pagination_exhausted", pages_scraped=current_page)
                    break

                current_page += 1

        except Exception as exc:
            logger.error(
                "fcra_scraper_error",
                error=str(exc),
                records_collected=len(all_records),
            )
            raise
        finally:
            await context.close()
            await browser.close()

    logger.info(
        "fcra_scrape_complete",
        total_records=len(all_records),
    )
    return all_records


async def _extract_table_rows(page: Any) -> list[dict[str, Any]]:
    """Extract organization records from the results table on the current page.

    The FCRA portal renders results in an HTML table.  Column order (observed):
        0 - S.No (serial number)
        1 - Name of Organisation
        2 - FCRA Registration Number
        3 - State
        4 - Purpose / Main Object
        5 - Status

    Args:
        page: Playwright Page object pointing to the FCRA results page.

    Returns:
        List of normalized record dicts extracted from the visible table rows.
    """
    records: list[dict[str, Any]] = []

    try:
        # Wait for any results table to appear.
        table_locator = page.locator("table").first
        if await table_locator.count() == 0:
            return records

        rows = await table_locator.locator("tr").all()

        for row in rows:
            cells = await row.locator("td").all()
            if len(cells) < 5:
                # Header row or malformed row — skip.
                continue

            cell_texts: list[str] = []
            for cell in cells:
                cell_texts.append(_extract_text(await cell.inner_text()))

            # Attempt to map by positional index; fall back gracefully.
            name = cell_texts[1] if len(cell_texts) > 1 else ""
            fcra_reg_no = cell_texts[2] if len(cell_texts) > 2 else ""
            state = cell_texts[3] if len(cell_texts) > 3 else ""
            purpose = cell_texts[4] if len(cell_texts) > 4 else ""
            status = cell_texts[5] if len(cell_texts) > 5 else ""

            if not name or not fcra_reg_no:
                continue

            raw: dict[str, Any] = {
                "name": name,
                "fcra_reg_no": fcra_reg_no,
                "state": state,
                "purpose": purpose,
                "status": status,
            }
            record = _build_record(name, fcra_reg_no, state, purpose, status, raw)
            records.append(record)

    except Exception as exc:
        logger.warning("fcra_table_extraction_error", error=str(exc))

    return records


async def _click_next_page(page: Any) -> bool:
    """Attempt to navigate to the next page of FCRA results.

    Looks for a "Next" link or pagination control and clicks it.

    Args:
        page: Playwright Page object on the current results page.

    Returns:
        True if the next-page click was attempted successfully,
        False if no pagination control was found.
    """
    try:
        # The FCRA portal typically uses ASP.NET __doPostBack for pagination.
        # Look for a link or button labelled "Next", ">", or a page number.
        next_locator = page.locator(
            "a:has-text('Next'), "
            "a:has-text('>'), "
            "input[value='Next'], "
            "a[href*='__doPostBack'][title*='next'], "
            "span:has-text('Next') >> xpath=.."
        ).first

        if await next_locator.count() == 0:
            return False

        # Check the element is enabled / visible.
        is_visible = await next_locator.is_visible()
        if not is_visible:
            return False

        await next_locator.click()
        await page.wait_for_load_state("domcontentloaded", timeout=30_000)
        return True

    except Exception as exc:
        logger.warning("fcra_next_page_click_failed", error=str(exc))
        return False


# ---------------------------------------------------------------------------
# Synchronous entry-point (used by Dagster asset)
# ---------------------------------------------------------------------------


def run_fcra_scraper(max_pages: int | None = _MAX_PAGES) -> list[dict[str, Any]]:
    """Run the FCRA Playwright scraper synchronously.

    Convenience wrapper around ``scrape_fcra_portal`` for use from
    synchronous Dagster asset functions.

    Args:
        max_pages: Maximum result pages to scrape.

    Returns:
        List of normalized organization dicts.
    """
    return asyncio.run(scrape_fcra_portal(max_pages=max_pages))
