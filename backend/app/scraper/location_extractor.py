import re
from typing import Optional

SRI_LANKA_SUBURBS = [
    # Colombo Postal Districts & Neighborhoods
    "Colombo 1", "Colombo 2", "Colombo 3", "Colombo 4", "Colombo 5",
    "Colombo 6", "Colombo 7", "Colombo 8", "Colombo 9", "Colombo 10",
    "Colombo 11", "Colombo 12", "Colombo 13", "Colombo 14", "Colombo 15",
    "Colombo 01", "Colombo 02", "Colombo 03", "Colombo 04", "Colombo 05",
    "Colombo 06", "Colombo 07", "Colombo 08", "Colombo 09",
    "Fort", "Slave Island", "Kollupitiya", "Colpetty", "Bambalapitiya",
    "Havelock Town", "Havelock City", "Havelock", "Wellawatte", "Wellawatta",
    "Cinnamon Gardens", "Borella", "Dematagoda", "Maradana", "Pettah",
    "Kotahena", "Grandpass", "Mutwal", "Mattakkuliya", "Bloemendhal", "Maligawatta",

    # Greater Colombo Suburbs (Kotte, Kaduwela, Kesbewa, Maharagama, etc.)
    "Rajagiriya", "Aggona", "Battaramulla", "Thalawathugoda", "Pelawatte", "Pelawatta",
    "Koswatte", "Koswatta", "Hokandara", "Malabe", "Athurugiriya", "Kaduwela",
    "Kolonnawa", "Kotikawatta", "Angoda", "Mulleriyawa", "Wellampitiya",
    "Nugegoda", "Nawala", "Kohuwala", "Kohuwela", "Maharagama", "Boralesgamuwa",
    "Kottawa", "Pannipitiya", "Homagama", "Meegoda", "Godagama", "Padukka", "Hanwella",
    "Piliyandala", "Kesbewa", "Kahathuduwa", "Polgasowita", "Madapatha", "Bokundara",
    "Dehiwala", "Mount Lavinia", "Mt Lavinia", "Ratmalana", "Attidiya",
    "Moratuwa", "Rawathawatte", "Lunawa", "Moratumulla", "Katubedda", "Angulana",
    "Ethul Kotte", "Pita Kotte", "Kotte", "Mirihana", "Embuldeniya", "Madiwela", "Kalalgoda",
    "Thalahena", "Arangala", "Kimbulawala", "Thalangama", "Akuregoda",

    # Gampaha District
    "Kadawatha", "Kiribathgoda", "Kelaniya", "Peliyagoda", "Wattala", "Hendala", "Mabola",
    "Ja-Ela", "Ja Ela", "Kandana", "Ragama", "Mahabage", "Seeduwa", "Katunayake", "Negombo",
    "Gampaha", "Yakkala", "Mirigama", "Nittambuwa", "Veyangoda", "Minuwangoda",
    "Divulapitiya", "Delgoda", "Biyagama", "Sapugaskanda", "Weliweriya", "Kirindiwela",
    "Ganemulla", "Pugoda", "Papiliyawala",

    # Kalutara District
    "Panadura", "Wadduwa", "Kalutara", "Beruwala", "Aluthgama", "Horana",
    "Bandaragama", "Ingiriya", "Matugama",

    # Other Major Real Estate Hubs
    "Peradeniya", "Katugastota", "Kundasale", "Digana", "Gampola",
    "Haloluwa", "Ampitiya", "Pilimathalawa", "Akurana",
    "Galle", "Unawatuna", "Hikkaduwa", "Matara", "Kurunegala", "Ratnapura",
    "Higurakgoda", "Hingurakgoda", "Anuradhapura", "Dambulla", "Nuwara Eliya"
]

# Broad administrative districts (not specific suburbs)
BROAD_DISTRICTS = {
    "colombo", "gampaha", "kalutara", "kandy", "galle", "matara",
    "kurunegala", "ratnapura", "anuradhapura", "badulla", "matale",
    "nuwara eliya", "kegalle", "puttalam", "trincomalee", "batticaloa",
    "jaffna", "vavuniya", "polonnaruwa", "monaragala", "hambantota",
    "ampara", "mannar", "kilinochchi", "mullaitivu"
}

# Canonical normalization map
CANONICAL_MAP = {
    "colombo 01": "Colombo 1",
    "colombo 02": "Colombo 2",
    "colombo 03": "Colombo 3",
    "colombo 04": "Colombo 4",
    "colombo 05": "Colombo 5",
    "colombo 06": "Colombo 6",
    "colombo 07": "Colombo 7",
    "colombo 08": "Colombo 8",
    "colombo 09": "Colombo 9",
    "colpetty": "Kollupitiya",
    "wellawatta": "Wellawatte",
    "pelawatta": "Pelawatte",
    "koswatta": "Koswatte",
    "kohuwela": "Kohuwala",
    "mt lavinia": "Mount Lavinia",
    "ja ela": "Ja-Ela",
    "higurakgoda": "Hingurakgoda",
}

# Sort candidate suburbs by length descending to match multi-word names first
_SORTED_SUBURBS = sorted(SRI_LANKA_SUBURBS, key=len, reverse=True)


def extract_suburb(
    title: Optional[str] = None,
    slug: Optional[str] = None,
    district: Optional[str] = None
) -> Optional[str]:
    """
    Extracts the most specific town/suburb from listing title or slug.
    Excludes broad district matches (e.g. 'Colombo', 'Kandy') unless it's a specific postal zone like 'Colombo 6'.
    """
    district_clean = (district or "").strip().lower()

    def _find_match(text: str) -> Optional[str]:
        if not text:
            return None
        for sub in _SORTED_SUBURBS:
            pattern = r"\b" + re.escape(sub) + r"\b"
            if re.search(pattern, text, re.IGNORECASE):
                canon = CANONICAL_MAP.get(sub.lower(), sub)
                # If matched name is just a broad district (e.g. 'Colombo', 'Kandy'), ignore it as a suburb
                if canon.lower() in BROAD_DISTRICTS:
                    continue
                # If matched name equals the provided district/area, skip to see if there is a more scoped suburb
                if canon.lower() == district_clean:
                    continue
                return canon
        return None

    # 1. Try title first
    if title:
        matched = _find_match(title)
        if matched:
            return matched

    # 2. Try cleaned slug (strip trailing duplicate id like -1, -2, -3)
    if slug:
        cleaned_slug = re.sub(r"-\d+$", "", slug)
        slug_text = cleaned_slug.replace("-", " ")
        matched = _find_match(slug_text)
        if matched:
            return matched

    # 3. If district itself is already a specific suburb (not a broad district)
    if district and district_clean not in BROAD_DISTRICTS:
        return district.strip()

    return None
