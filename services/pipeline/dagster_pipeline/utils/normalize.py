from __future__ import annotations

import hashlib
import re
import unicodedata

import structlog

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# ISO 3166-1 alpha-2 country code normalization map.
# Keys are common variants (names, 3-letter codes, aliases); values are
# canonical 2-letter codes.
# ---------------------------------------------------------------------------
_COUNTRY_MAP: dict[str, str] = {
    # United States
    "united states": "US",
    "united states of america": "US",
    "usa": "US",
    "us": "US",
    # United Kingdom
    "united kingdom": "GB",
    "great britain": "GB",
    "england": "GB",
    "scotland": "GB",
    "wales": "GB",
    "northern ireland": "GB",
    "uk": "GB",
    "gbr": "GB",
    # Canada
    "canada": "CA",
    "can": "CA",
    # Australia
    "australia": "AU",
    "aus": "AU",
    # Germany
    "germany": "DE",
    "deutschland": "DE",
    "deu": "DE",
    # France
    "france": "FR",
    "fra": "FR",
    # India
    "india": "IN",
    "ind": "IN",
    # Japan
    "japan": "JP",
    "jpn": "JP",
    # Netherlands
    "netherlands": "NL",
    "holland": "NL",
    "nld": "NL",
    # Switzerland
    "switzerland": "CH",
    "che": "CH",
    # Sweden
    "sweden": "SE",
    "swe": "SE",
    # Norway
    "norway": "NO",
    "nor": "NO",
    # Denmark
    "denmark": "DK",
    "dnk": "DK",
    # New Zealand
    "new zealand": "NZ",
    "nzl": "NZ",
    # Ireland
    "ireland": "IE",
    "irl": "IE",
    # Brazil
    "brazil": "BR",
    "brasil": "BR",
    "bra": "BR",
    # Kenya
    "kenya": "KE",
    "ken": "KE",
    # South Africa
    "south africa": "ZA",
    "zaf": "ZA",
    # Nigeria
    "nigeria": "NG",
    "nga": "NG",
}

# ---------------------------------------------------------------------------
# org_type mapping: raw registry values -> canonical OpenGive org_type values.
# Valid targets (from DB CHECK constraint):
#   'charity', 'foundation', 'ngo', 'nonprofit', 'association',
#   'trust', 'cooperative', 'social_enterprise', 'religious', 'other'
# ---------------------------------------------------------------------------
_ORG_TYPE_MAPS: dict[str, dict[str, str]] = {
    "us_propublica": {
        # NTEE major groups A-Z mapped to canonical types
        "a": "nonprofit",       # Arts, Culture, Humanities
        "b": "nonprofit",       # Education
        "c": "nonprofit",       # Environment
        "d": "nonprofit",       # Animal-Related
        "e": "nonprofit",       # Health Care
        "f": "nonprofit",       # Mental Health
        "g": "nonprofit",       # Diseases, Disorders, Medical Disciplines
        "h": "nonprofit",       # Medical Research
        "i": "nonprofit",       # Crime, Legal Related
        "j": "nonprofit",       # Employment, Job Related
        "k": "nonprofit",       # Food, Agriculture, Nutrition
        "l": "nonprofit",       # Housing, Shelter
        "m": "nonprofit",       # Public Safety, Disaster Preparedness
        "n": "nonprofit",       # Recreation, Sports, Leisure, Athletics
        "o": "nonprofit",       # Youth Development
        "p": "association",     # Human Services
        "q": "ngo",             # International, Foreign Affairs
        "r": "association",     # Civil Rights, Social Action, Advocacy
        "s": "association",     # Community Improvement, Capacity Building
        "t": "foundation",      # Philanthropy, Voluntarism, Grantmaking
        "u": "nonprofit",       # Science and Technology Research
        "v": "nonprofit",       # Social Science Research
        "w": "nonprofit",       # Public, Society Benefit
        "x": "religious",       # Religion-Related
        "y": "association",     # Mutual/Membership Benefit
        "z": "other",           # Unknown
        # Also handle full strings
        "charity": "charity",
        "foundation": "foundation",
        "religious organization": "religious",
        "cooperative": "cooperative",
        "trust": "trust",
        "social welfare organization": "nonprofit",
        "labor organization": "association",
        "agricultural organization": "association",
        "business league": "association",
    },
    "uk_charity_commission": {
        "charitable incorporated organisation": "charity",
        "cio": "charity",
        "charitable company": "charity",
        "unincorporated association": "association",
        "trust": "trust",
        "foundation": "foundation",
        "religious charity": "religious",
        "housing association": "association",
        "community benefit society": "cooperative",
        "community interest company": "social_enterprise",
        "cic": "social_enterprise",
        "cooperative": "cooperative",
        "exempt charity": "charity",
        "excepted charity": "charity",
        "ngo": "ngo",
        "ngdo": "ngo",
        "other": "other",
    },
}

# Fallback keyword matching (applied when exact registry map misses)
_KEYWORD_ORG_TYPE: list[tuple[str, str]] = [
    ("foundation", "foundation"),
    ("trust", "trust"),
    ("religious", "religious"),
    ("church", "religious"),
    ("mosque", "religious"),
    ("temple", "religious"),
    ("synagogue", "religious"),
    ("cooperative", "cooperative"),
    ("co-op", "cooperative"),
    ("social enterprise", "social_enterprise"),
    ("community interest", "social_enterprise"),
    ("ngo", "ngo"),
    ("ngdo", "ngo"),
    ("association", "association"),
    ("society", "association"),
    ("federation", "association"),
    ("union", "association"),
    ("charity", "charity"),
    ("charitable", "charity"),
    ("nonprofit", "nonprofit"),
    ("non-profit", "nonprofit"),
    ("not-for-profit", "nonprofit"),
]


def generate_slug(name: str) -> str:
    """Convert an organization name to a URL-safe kebab-case slug.

    Normalizes Unicode characters to ASCII equivalents, lowercases the text,
    replaces all non-alphanumeric characters with hyphens, and collapses
    consecutive hyphens into one.

    Args:
        name: The raw organization name.

    Returns:
        A kebab-case ASCII slug derived from the name.

    Examples:
        >>> generate_slug("American Red Cross")
        'american-red-cross'
        >>> generate_slug("Médecins Sans Frontières")
        'medecins-sans-frontieres'
        >>> generate_slug("  YMCA -- Greater NYC  ")
        'ymca-greater-nyc'
    """
    # Normalize Unicode to NFKD, encode to ASCII (ignore non-ASCII)
    normalized = unicodedata.normalize("NFKD", name)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")

    # Lowercase
    lowered = ascii_text.lower()

    # Replace any non-alphanumeric character with a hyphen
    hyphenated = re.sub(r"[^a-z0-9]+", "-", lowered)

    # Strip leading/trailing hyphens and collapse internal runs
    slug = hyphenated.strip("-")

    if not slug:
        logger.warning("generate_slug_empty_result", original_name=name)
        return "unknown"

    return slug


def normalize_country(country: str) -> str:
    """Map a country string to its ISO 3166-1 alpha-2 code.

    Performs a case-insensitive lookup against a curated mapping table.
    Returns the input uppercased (assuming it may already be a valid 2-letter
    code) when no mapping is found, and logs a warning.

    Args:
        country: A country name, 3-letter code, or 2-letter code.

    Returns:
        ISO 3166-1 alpha-2 country code (2 uppercase letters), or the
        uppercased input stripped of whitespace if no match is found.

    Examples:
        >>> normalize_country("United States")
        'US'
        >>> normalize_country("gbr")
        'GB'
        >>> normalize_country("US")
        'US'
    """
    stripped = country.strip()
    lookup_key = stripped.lower()

    if lookup_key in _COUNTRY_MAP:
        return _COUNTRY_MAP[lookup_key]

    # Already a 2-letter code?
    if len(stripped) == 2 and stripped.isalpha():
        return stripped.upper()

    logger.warning("normalize_country_unknown", country=country)
    return stripped.upper()


def compute_content_hash(content: bytes) -> str:
    """Compute a SHA-256 hex digest of raw bytes for change detection.

    Used to determine whether a fetched record differs from the previously
    stored version, avoiding unnecessary upserts.

    Args:
        content: Raw bytes to hash (e.g. a serialized JSON response body).

    Returns:
        Lowercase hexadecimal SHA-256 digest string (64 characters).

    Examples:
        >>> compute_content_hash(b"hello")
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    """
    return hashlib.sha256(content).hexdigest()


def map_org_type(raw_type: str, registry: str) -> str:
    """Map a registry-specific organization type string to an OpenGive canonical type.

    Applies an exact lookup against the registry-specific map first, then falls
    back to keyword matching, and finally defaults to 'other'.

    Valid canonical types (from the DB CHECK constraint):
        'charity', 'foundation', 'ngo', 'nonprofit', 'association',
        'trust', 'cooperative', 'social_enterprise', 'religious', 'other'

    Args:
        raw_type: The raw organization type string from the source registry.
        registry: The registry identifier, e.g. 'us_propublica' or
            'uk_charity_commission'.

    Returns:
        A canonical OpenGive org_type string.

    Examples:
        >>> map_org_type("Charitable Incorporated Organisation", "uk_charity_commission")
        'charity'
        >>> map_org_type("T", "us_propublica")
        'foundation'
        >>> map_org_type("some unknown type", "us_propublica")
        'other'
    """
    normalized_raw = raw_type.strip().lower()
    registry_map = _ORG_TYPE_MAPS.get(registry, {})

    # 1. Exact match in registry-specific map
    if normalized_raw in registry_map:
        return registry_map[normalized_raw]

    # 2. Single-character NTEE code or short NTEE code like "T20" (ProPublica prefix).
    # Only apply when the input looks like an NTEE code: 1–4 characters where the
    # first character is a letter.  Long strings such as "some type description" must
    # not be treated as NTEE codes.
    if registry == "us_propublica" and 1 <= len(normalized_raw) <= 4:
        first_char = normalized_raw[0]
        if first_char.isalpha() and first_char in registry_map:
            return registry_map[first_char]

    # 3. Keyword fallback (ordered by specificity)
    for keyword, canonical in _KEYWORD_ORG_TYPE:
        if keyword in normalized_raw:
            return canonical

    logger.warning(
        "map_org_type_unknown",
        raw_type=raw_type,
        registry=registry,
        defaulting_to="other",
    )
    return "other"
