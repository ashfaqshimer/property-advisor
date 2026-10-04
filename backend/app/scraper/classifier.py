from app.scraper.schemas import IkmanAd, LpwAd, LpwAdDetail


def classify_listing_heuristics(ad: IkmanAd) -> tuple[str, int, list[str]]:
    """
    Classifies a listing as 'broker' or 'owner' based on heuristics.
    Returns: (classification, confidence, reasons)
    """
    reasons = []
    broker_score = 0

    if ad.isAuthDealer:
        broker_score = 95
        reasons.append("is_auth_dealer")
    elif ad.isMember and ad.membershipLevel == "premium":
        broker_score = 90
        reasons.append("premium_member")
    elif ad.isMember and ad.membershipLevel == "plus":
        broker_score = 85
        reasons.append("plus_member")
    elif ad.isMember:
        broker_score = 80
        reasons.append("is_member")
    
    if ad.shopName and ad.shopName.strip():
        # If they didn't get scored above, score them now
        if broker_score < 75:
            broker_score = 75
        reasons.append(f"shop_name: {ad.shopName}")

    if broker_score > 0:
        return ("broker", broker_score, reasons)

    # Likely private owner
    if not ad.isMember and not ad.shopName:
        owner_confidence = 85
        reasons.append("no_membership_no_shop")
    else:
        owner_confidence = 60
        reasons.append("no_strong_signals")

    return ("owner", owner_confidence, reasons)


def classify_lpw_listing_heuristics(
    ad: LpwAd,
    detail: LpwAdDetail | None = None
) -> tuple[str, int, list[str]]:
    """
    Classifies a LankaPropertyWeb listing as 'broker' or 'owner'.
    Returns: (classification, confidence, reasons)
    """
    reasons = []

    # 1. Detail-level explicit advertiser label
    if detail and detail.agent_type:
        agent_type_lower = detail.agent_type.strip().lower()
        if "owner" in agent_type_lower:
            return ("owner", 95, ["lpw_explicit_owner_tag"])
        if "agent" in agent_type_lower or "broker" in agent_type_lower:
            return ("broker", 95, ["lpw_explicit_agent_tag"])
        if "developer" in agent_type_lower or "builder" in agent_type_lower:
            return ("broker", 90, ["lpw_developer_tag"])

    # 2. Search card agency logo
    if ad.has_agent_logo:
        return ("broker", 85, ["lpw_agency_logo_detected"])

    # 3. Content heuristics for title and snippet
    text_corpus = f"{ad.title or ''} {ad.description_snippet or ''}".lower()
    broker_terms = [
        "real estate",
        "realtors",
        "properties (pvt)",
        "pvt ltd",
        "holdings",
        "half month agent fee",
        "agent fee applicable",
        "professional fee",
        "call our agent",
    ]
    for term in broker_terms:
        if term in text_corpus:
            return ("broker", 80, [f"broker_keyword:{term}"])

    # 4. Default to owner with moderate confidence
    return ("owner", 75, ["no_agency_logo", "no_broker_signals"])
