from __future__ import annotations

import pytest

from dagster_pipeline.utils.normalize import (
    compute_content_hash,
    generate_slug,
    map_org_type,
    normalize_country,
)


# ---------------------------------------------------------------------------
# generate_slug
# ---------------------------------------------------------------------------


class TestGenerateSlug:
    def test_simple_name(self) -> None:
        assert generate_slug("American Red Cross") == "american-red-cross"

    def test_unicode_accents(self) -> None:
        assert generate_slug("Médecins Sans Frontières") == "medecins-sans-frontieres"

    def test_extra_whitespace_and_dashes(self) -> None:
        assert generate_slug("  YMCA -- Greater NYC  ") == "ymca-greater-nyc"

    def test_ampersand_and_symbols(self) -> None:
        result = generate_slug("Boys & Girls Clubs of America")
        assert result == "boys-girls-clubs-of-america"

    def test_numeric_in_name(self) -> None:
        assert generate_slug("21st Century Foundation") == "21st-century-foundation"

    def test_all_special_chars(self) -> None:
        # Should fall back to 'unknown' when nothing remains after stripping
        assert generate_slug("---") == "unknown"

    def test_empty_string(self) -> None:
        assert generate_slug("") == "unknown"

    def test_no_consecutive_hyphens(self) -> None:
        slug = generate_slug("A  B   C")
        assert "--" not in slug

    def test_no_leading_trailing_hyphens(self) -> None:
        slug = generate_slug("!Hello World!")
        assert not slug.startswith("-")
        assert not slug.endswith("-")


# ---------------------------------------------------------------------------
# normalize_country
# ---------------------------------------------------------------------------


class TestNormalizeCountry:
    @pytest.mark.parametrize(
        "raw, expected",
        [
            ("United States", "US"),
            ("united states of america", "US"),
            ("USA", "US"),
            ("us", "US"),
            ("United Kingdom", "GB"),
            ("great britain", "GB"),
            ("GBR", "GB"),
            ("uk", "GB"),
            ("England", "GB"),
            ("Canada", "CA"),
            ("australia", "AU"),
            ("Germany", "DE"),
            ("France", "FR"),
            # Already a valid 2-letter code
            ("DE", "DE"),
            ("FR", "FR"),
        ],
    )
    def test_known_countries(self, raw: str, expected: str) -> None:
        assert normalize_country(raw) == expected

    def test_unknown_country_returns_uppercased(self) -> None:
        result = normalize_country("Atlantis")
        assert result == "ATLANTIS"

    def test_whitespace_stripped(self) -> None:
        assert normalize_country("  US  ") == "US"


# ---------------------------------------------------------------------------
# compute_content_hash
# ---------------------------------------------------------------------------


class TestComputeContentHash:
    def test_known_hash(self) -> None:
        # SHA-256 of b"hello"
        expected = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        assert compute_content_hash(b"hello") == expected

    def test_empty_bytes(self) -> None:
        result = compute_content_hash(b"")
        assert len(result) == 64
        assert result == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    def test_different_content_produces_different_hash(self) -> None:
        h1 = compute_content_hash(b"data1")
        h2 = compute_content_hash(b"data2")
        assert h1 != h2

    def test_same_content_produces_same_hash(self) -> None:
        content = b"repeatable content"
        assert compute_content_hash(content) == compute_content_hash(content)

    def test_returns_lowercase_hex(self) -> None:
        result = compute_content_hash(b"test")
        assert result == result.lower()
        assert all(c in "0123456789abcdef" for c in result)


# ---------------------------------------------------------------------------
# map_org_type
# ---------------------------------------------------------------------------


class TestMapOrgType:
    # --- ProPublica / US ---

    def test_propublica_ntee_t_is_foundation(self) -> None:
        assert map_org_type("T", "us_propublica") == "foundation"

    def test_propublica_ntee_t_lowercase(self) -> None:
        assert map_org_type("t", "us_propublica") == "foundation"

    def test_propublica_ntee_x_is_religious(self) -> None:
        assert map_org_type("X", "us_propublica") == "religious"

    def test_propublica_ntee_q_is_ngo(self) -> None:
        assert map_org_type("Q", "us_propublica") == "ngo"

    def test_propublica_ntee_code_with_suffix(self) -> None:
        # NTEE code like "T20" — first char 'T' -> foundation
        assert map_org_type("T20", "us_propublica") == "foundation"

    def test_propublica_explicit_foundation(self) -> None:
        assert map_org_type("foundation", "us_propublica") == "foundation"

    def test_propublica_religious_organization(self) -> None:
        assert map_org_type("religious organization", "us_propublica") == "religious"

    # --- UK Charity Commission ---

    def test_uk_cio(self) -> None:
        assert map_org_type("Charitable Incorporated Organisation", "uk_charity_commission") == "charity"

    def test_uk_cio_abbreviation(self) -> None:
        assert map_org_type("CIO", "uk_charity_commission") == "charity"

    def test_uk_trust(self) -> None:
        assert map_org_type("trust", "uk_charity_commission") == "trust"

    def test_uk_social_enterprise(self) -> None:
        assert map_org_type("community interest company", "uk_charity_commission") == "social_enterprise"

    def test_uk_cooperative(self) -> None:
        assert map_org_type("cooperative", "uk_charity_commission") == "cooperative"

    # --- Fallback keyword matching ---

    def test_keyword_fallback_foundation(self) -> None:
        assert map_org_type("random foundation type", "unknown_registry") == "foundation"

    def test_keyword_fallback_religious(self) -> None:
        assert map_org_type("a church group", "unknown_registry") == "religious"

    def test_keyword_fallback_ngo(self) -> None:
        assert map_org_type("international ngo", "unknown_registry") == "ngo"

    # --- Default 'other' ---

    def test_unknown_type_defaults_to_other(self) -> None:
        assert map_org_type("some completely unknown type", "us_propublica") == "other"

    def test_empty_string_defaults_to_other(self) -> None:
        assert map_org_type("", "us_propublica") == "other"
