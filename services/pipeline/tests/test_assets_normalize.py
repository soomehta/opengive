from __future__ import annotations

import pandas as pd
import pytest
from dagster import build_asset_context

from dagster_pipeline.assets.uk_charity_commission import normalize_uk_charity_commission
from dagster_pipeline.assets.us_propublica import normalize_propublica


def _ctx() -> object:
    """Return a real Dagster asset context suitable for direct asset invocation."""
    return build_asset_context()


# ---------------------------------------------------------------------------
# normalize_propublica
# ---------------------------------------------------------------------------


class TestNormalizePropublica:
    def _make_raw_df(self, overrides: dict | None = None) -> pd.DataFrame:
        row: dict = {
            "ein": "530196605",
            "name": "American Red Cross",
            "city": "Washington",
            "state": "DC",
            "ntee_code": "P",
            "ntee_description": "Human Services",
            "website": "https://www.redcross.org",
            "ruling_date": "1938-01-01",
        }
        if overrides:
            row.update(overrides)
        return pd.DataFrame([row])

    def test_maps_ein_to_registry_id(self) -> None:
        df = normalize_propublica(_ctx(), self._make_raw_df())
        assert df.iloc[0]["registry_id"] == "530196605"

    def test_registry_source_is_us_propublica(self) -> None:
        df = normalize_propublica(_ctx(), self._make_raw_df())
        assert df.iloc[0]["registry_source"] == "us_propublica"

    def test_country_code_is_us(self) -> None:
        df = normalize_propublica(_ctx(), self._make_raw_df())
        assert df.iloc[0]["country_code"] == "US"

    def test_slug_generated_from_name(self) -> None:
        df = normalize_propublica(_ctx(), self._make_raw_df())
        assert df.iloc[0]["slug"] == "american-red-cross"

    def test_name_preserved(self) -> None:
        df = normalize_propublica(_ctx(), self._make_raw_df())
        assert df.iloc[0]["name"] == "American Red Cross"

    def test_city_mapped(self) -> None:
        df = normalize_propublica(_ctx(), self._make_raw_df())
        assert df.iloc[0]["city"] == "Washington"

    def test_state_province_mapped(self) -> None:
        df = normalize_propublica(_ctx(), self._make_raw_df())
        assert df.iloc[0]["state_province"] == "DC"

    def test_website_mapped(self) -> None:
        df = normalize_propublica(_ctx(), self._make_raw_df())
        assert df.iloc[0]["website"] == "https://www.redcross.org"

    def test_org_type_mapped_via_ntee(self) -> None:
        # NTEE 'T' -> foundation
        df = normalize_propublica(
            _ctx(), self._make_raw_df({"ntee_code": "T"})
        )
        assert df.iloc[0]["org_type"] == "foundation"

    def test_content_hash_column_present(self) -> None:
        df = normalize_propublica(_ctx(), self._make_raw_df())
        assert "_content_hash" in df.columns
        assert len(df.iloc[0]["_content_hash"]) == 64

    def test_missing_ein_row_skipped(self) -> None:
        raw = self._make_raw_df({"ein": ""})
        df = normalize_propublica(_ctx(), raw)
        assert len(df) == 0

    def test_empty_dataframe_returns_empty(self) -> None:
        df = normalize_propublica(_ctx(), pd.DataFrame())
        assert df.empty

    def test_status_defaults_to_active(self) -> None:
        df = normalize_propublica(_ctx(), self._make_raw_df())
        assert df.iloc[0]["status"] == "active"

    def test_multiple_rows(self) -> None:
        rows = pd.DataFrame(
            [
                {"ein": "111111111", "name": "Org One", "ntee_code": "T"},
                {"ein": "222222222", "name": "Org Two", "ntee_code": "X"},
            ]
        )
        df = normalize_propublica(_ctx(), rows)
        assert len(df) == 2

    def test_subsector_from_ntee_description(self) -> None:
        df = normalize_propublica(_ctx(), self._make_raw_df())
        assert df.iloc[0]["subsector"] == "Human Services"


# ---------------------------------------------------------------------------
# normalize_uk_charity_commission
# ---------------------------------------------------------------------------


class TestNormalizeUKCharityCommission:
    def _make_raw_df(self, overrides: dict | None = None) -> pd.DataFrame:
        row: dict = {
            "registeredCharityNumber": "220949",
            "charityName": "Oxfam",
            "charityType": "Charitable Incorporated Organisation",
            "charityActivities": "Relief of poverty worldwide",
            "charityWebsite": "https://www.oxfam.org.uk",
            "registrationDate": "1961-09-19",
            "status": "registered",
            "contact": {
                "town": "Oxford",
                "postcode": "OX4 2JY",
                "address1": "Oxfam House, John Smith Drive",
            },
        }
        if overrides:
            row.update(overrides)
        return pd.DataFrame([row])

    def test_maps_charity_number_to_registry_id(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["registry_id"] == "220949"

    def test_registry_source_is_uk_charity_commission(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["registry_source"] == "uk_charity_commission"

    def test_country_code_is_gb(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["country_code"] == "GB"

    def test_slug_generated(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["slug"] == "oxfam"

    def test_name_preserved(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["name"] == "Oxfam"

    def test_org_type_charity_for_cio(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["org_type"] == "charity"

    def test_mission_mapped(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["mission"] == "Relief of poverty worldwide"

    def test_website_mapped(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["website"] == "https://www.oxfam.org.uk"

    def test_city_extracted_from_contact(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["city"] == "Oxford"

    def test_postal_code_extracted_from_contact(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["postal_code"] == "OX4 2JY"

    def test_address_line1_extracted_from_contact(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["address_line1"] == "Oxfam House, John Smith Drive"

    def test_registration_date_mapped(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["registration_date"] == "1961-09-19"

    def test_status_active_for_registered(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["status"] == "active"

    def test_status_dissolved_for_removed(self) -> None:
        df = normalize_uk_charity_commission(
            _ctx(), self._make_raw_df({"status": "removed - dissolved"})
        )
        assert df.iloc[0]["status"] == "dissolved"

    def test_content_hash_present(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert "_content_hash" in df.columns
        assert len(df.iloc[0]["_content_hash"]) == 64

    def test_missing_charity_number_row_skipped(self) -> None:
        raw = self._make_raw_df({"registeredCharityNumber": ""})
        df = normalize_uk_charity_commission(_ctx(), raw)
        assert len(df) == 0

    def test_empty_dataframe_returns_empty(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), pd.DataFrame())
        assert df.empty

    def test_jurisdiction_is_england_and_wales(self) -> None:
        df = normalize_uk_charity_commission(_ctx(), self._make_raw_df())
        assert df.iloc[0]["jurisdiction"] == "England and Wales"

    def test_multiple_rows(self) -> None:
        rows = pd.DataFrame(
            [
                {"registeredCharityNumber": "111111", "charityName": "Charity A"},
                {"registeredCharityNumber": "222222", "charityName": "Charity B"},
            ]
        )
        df = normalize_uk_charity_commission(_ctx(), rows)
        assert len(df) == 2
