import re
from decimal import Decimal
from typing import Any

# Multipliers for Sri Lankan currency expressions
_MULTIPLIERS: dict[str, Decimal] = {
    "k": Decimal(1_000),
    "thousand": Decimal(1_000),
    "lakh": Decimal(100_000),
    "lakhs": Decimal(100_000),
    "lac": Decimal(100_000),
    "lacs": Decimal(100_000),
    "m": Decimal(1_000_000),
    "mn": Decimal(1_000_000),
    "million": Decimal(1_000_000),
    "crore": Decimal(10_000_000),
    "cr": Decimal(10_000_000),
    "b": Decimal(1_000_000_000),
    "billion": Decimal(1_000_000_000),
}

_NUMERIC_PATTERN = re.compile(r"^(?P<amount>\d+(?:\.\d+)?)\s*(?P<suffix>[a-z]+)?$")


def parse_lkr_price(raw_price: Any) -> tuple[Decimal | None, bool]:
    """
    Parses a raw price string or number into a numeric LKR Decimal and a boolean flag
    indicating if it is explicitly 'per perch' (common in Sri Lankan land listings).

    Returns:
        (amount: Decimal | None, is_per_perch: bool)
    """
    if raw_price is None:
        return None, False

    if isinstance(raw_price, (int, float, Decimal)):
        val = Decimal(str(raw_price))
        return (val if val > 0 else None), False

    text = str(raw_price).strip().lower()
    if not text:
        return None, False

    # Check for per-perch flags
    is_per_perch = False
    if "per perch" in text or "per-perch" in text or "/perch" in text or "per p" in text or "p.p" in text:
        is_per_perch = True
    elif text.endswith(" pp") or text.endswith("/p"):
        is_per_perch = True

    # Strip noise phrases
    clean_text = text
    # First remove commas and underscores directly so numbers like 4,500,000 don't get split into 4 500 000
    clean_text = clean_text.replace(",", "").replace("_", "")

    for phrase in [
        "per perch", "per-perch", "/perch", "per p", "p.p", "pp",
        "per month", "per year", "per day", "/month", "/mo", "/year",
        "negotiable", "total price", "advance", "lkr", "rs.", "rs", "rupees",
        "/"
    ]:
        clean_text = clean_text.replace(phrase, " ")

    clean_text = " ".join(clean_text.split()).strip()
    if not clean_text:
        return None, is_per_perch

    # Match number + optional suffix
    match = _NUMERIC_PATTERN.match(clean_text)
    if not match:
        # Fallback: find first numeric cluster with optional decimal
        cluster = re.search(r"(\d+(?:\.\d+)?)", clean_text)
        if not cluster:
            return None, is_per_perch
        try:
            amount = Decimal(cluster.group(1))
            return (amount if amount > 0 else None), is_per_perch
        except Exception:
            return None, is_per_perch

    try:
        amount = Decimal(match.group("amount"))
    except Exception:
        return None, is_per_perch

    suffix = match.group("suffix")
    if suffix:
        mult = _MULTIPLIERS.get(suffix)
        if mult:
            amount *= mult

    return (amount if amount > 0 else None), is_per_perch
