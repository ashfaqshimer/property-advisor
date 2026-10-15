"""Maintenance script to reclassify existing LPW prospects and clean placeholder poster names.

Usage:
    uv run python scripts/reclassify_lpw_prospects.py --dry-run
    uv run python scripts/reclassify_lpw_prospects.py --limit 50
    uv run python scripts/reclassify_lpw_prospects.py --only-placeholder-names
"""

import argparse
import asyncio
from pathlib import Path
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import or_, select

from app.db.session import SessionLocal
from app.models.prospect import Prospect
from app.scraper.classifier import classify_lpw_listing_heuristics
from app.scraper.lpw_client import LankaPropertyWebClient
from app.scraper.schemas import LpwAd


async def reclassify_prospects(
    dry_run: bool = True,
    limit: int | None = None,
    only_placeholders: bool = False,
    delay: float = 0.5,
) -> None:
    client = LankaPropertyWebClient(delay=delay)
    try:
        with SessionLocal() as db:
            query = select(Prospect).where(Prospect.source == "lpw")

            if only_placeholders:
                query = query.where(
                    or_(
                        Prospect.poster_name.in_(["Agent", "Owner", "Developer", "agent", "owner", "developer"]),
                    )
                )
            else:
                # Target active LPW prospects or prospects with placeholder names
                query = query.where(
                    or_(
                        Prospect.status == "new",
                        Prospect.poster_name.in_(["Agent", "Owner", "Developer", "agent", "owner", "developer"]),
                    )
                )

            query = query.order_by(Prospect.first_seen_at.desc())
            if limit:
                query = query.limit(limit)

            prospects = list(db.execute(query).scalars().all())
            print(f"Found {len(prospects)} LPW prospect(s) to inspect (dry_run={dry_run}).")

            updated_count = 0
            broker_discarded = 0
            name_fixed = 0

            for i, p in enumerate(prospects, 1):
                url = p.source_url or p.ikman_url
                if not url:
                    continue

                print(f"[{i}/{len(prospects)}] Checking {p.id} ({url.split('/')[-1]})...")
                try:
                    detail = await client.fetch_ad_detail(url)
                    if not detail:
                        print("    -> Unable to fetch detail page.")
                        continue

                    changes = []

                    # 1. Clean or update poster name
                    if detail.poster_name and p.poster_name != detail.poster_name:
                        old_name = p.poster_name
                        p.poster_name = detail.poster_name
                        name_fixed += 1
                        changes.append(f"poster_name: '{old_name}' -> '{detail.poster_name}'")
                    elif p.poster_name in ("Agent", "Owner", "Developer", "agent", "owner", "developer"):
                        old_name = p.poster_name
                        p.poster_name = None
                        name_fixed += 1
                        changes.append(f"cleared placeholder poster_name: '{old_name}' -> None")

                    # 2. Update phone if not set
                    if detail.phone_number and not p.phone_number:
                        p.phone_number = detail.phone_number
                        changes.append(f"phone: '{detail.phone_number}'")

                    # 3. Classify based on detail
                    dummy_ad = LpwAd(
                        id=p.source_id or str(p.id),
                        title=p.title,
                        url=url,
                    )
                    c_cls, c_conf, c_reas = classify_lpw_listing_heuristics(dummy_ad, detail=detail)

                    if p.classification != c_cls or p.confidence != c_conf:
                        changes.append(f"class: {p.classification} -> {c_cls} ({c_conf}%)")
                        p.classification = c_cls
                        p.confidence = c_conf
                        p.classification_reasons = c_reas

                    # 4. If broker, discard from active pipeline
                    if c_cls == "broker" and p.status == "new":
                        p.status = "discarded"
                        p.discard_reason = "broker_signal"
                        broker_discarded += 1
                        changes.append("status: new -> discarded (broker_signal)")

                    if changes:
                        updated_count += 1
                        print("    Changes: " + "; ".join(changes))
                    else:
                        print("    No changes needed.")

                except Exception as exc:
                    print(f"    Error inspecting {p.id}: {exc}")

            if not dry_run:
                db.commit()
                print(f"\nDone! Committed changes for {updated_count} prospect(s).")
            else:
                db.rollback()
                print(f"\n[DRY RUN] Would have updated {updated_count} prospect(s) ({broker_discarded} broker discards, {name_fixed} name fixes).")

    finally:
        await client.close()


def main():
    parser = argparse.ArgumentParser(description="Reclassify LPW prospects and clean placeholder names.")
    parser.add_argument("--dry-run", action="store_true", default=False, help="Run without committing changes.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of records to process.")
    parser.add_argument("--only-placeholder-names", action="store_true", default=False, help="Only process records with placeholder poster names.")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between HTTP requests in seconds.")
    args = parser.parse_args()

    asyncio.run(reclassify_prospects(
        dry_run=args.dry_run,
        limit=args.limit,
        only_placeholders=args.only_placeholder_names,
        delay=args.delay,
    ))


if __name__ == "__main__":
    main()
