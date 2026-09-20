from app.scraper.schemas import IkmanAd


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
