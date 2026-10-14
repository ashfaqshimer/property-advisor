"""Sync operational data from Production database to Development database.

Copies properties, prospects, leads, chats, and related records from PROD into DEV,
while strictly preserving:
- `site_configurations` (keeps dev scanner settings disabled, dev config intact)
- `staff_sessions` (keeps active local dev browser sessions intact)
- `alembic_version` (preserves dev migration state)

PROD connection is strictly read-only.
"""

import argparse
from pathlib import Path
import sys
from urllib.parse import urlparse

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg
from psycopg import sql

# Ordered insertion to satisfy foreign key constraints.
SYNC_TABLES = [
    "suburbs",
    "market_benchmarks",
    "location_cache",
    "scan_jobs",
    "property_contacts",
    "property_contact_phones",
    "prospects",
    "properties",
    "conversations",
    "messages",
    "leads",
    "field_assignments",
]

# Explicitly excluded tables
EXCLUDED_TABLES = [
    "site_configurations",
    "staff_sessions",
    "alembic_version",
    "spatial_ref_sys",
]


def sanitize_url_for_display(raw_url: str) -> str:
    """Mask password in URL for safe console output."""
    try:
        parsed = urlparse(raw_url)
        netloc = parsed.netloc
        if "@" in netloc:
            creds, host = netloc.split("@", 1)
            user = creds.split(":", 1)[0]
            netloc = f"{user}:***@{host}"
        return f"{parsed.scheme}://{netloc}{parsed.path}"
    except Exception:
        return "<invalid url>"


def extract_host(raw_url: str) -> str:
    try:
        return urlparse(raw_url).hostname or ""
    except Exception:
        return ""


def get_table_columns(cur, table_name: str) -> list[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table_name,),
    )
    return [row[0] for row in cur.fetchall()]


def sync_staff_users(prod_cur, dev_cur) -> int:
    """Sync staff_users from prod into dev, aligning IDs with prod while preserving dev sessions."""
    prod_cols = get_table_columns(prod_cur, "staff_users")
    dev_cols = get_table_columns(dev_cur, "staff_users")
    common_cols = [c for c in prod_cols if c in dev_cols]

    col_identifiers = [sql.Identifier(c) for c in common_cols]
    col_list_sql = sql.SQL(", ").join(col_identifiers)

    prod_cur.execute(sql.SQL("SELECT {} FROM staff_users").format(col_list_sql))
    prod_rows = prod_cur.fetchall()

    if not prod_rows:
        return 0

    # Get existing dev users: email -> id
    dev_cur.execute("SELECT email, id FROM staff_users")
    dev_user_map = {row[0]: row[1] for row in dev_cur.fetchall()}

    id_idx = common_cols.index("id")
    email_idx = common_cols.index("email")

    for row in prod_rows:
        prod_id = row[id_idx]
        prod_email = row[email_idx]

        if prod_email in dev_user_map:
            dev_id = dev_user_map[prod_email]
            if dev_id != prod_id:
                # Rename old dev user email temporarily to prevent unique constraint violation
                dev_cur.execute(
                    "UPDATE staff_users SET email = %s WHERE id = %s",
                    (f"{prod_email}.sync-old", dev_id),
                )
                # Insert the prod user with prod ID
                placeholders = sql.SQL(", ").join([sql.Placeholder() for _ in common_cols])
                insert_sql = sql.SQL(
                    "INSERT INTO staff_users ({cols}) VALUES ({placeholders})"
                ).format(cols=col_list_sql, placeholders=placeholders)
                dev_cur.execute(insert_sql, row)

                # Re-link active sessions in dev to the new prod user ID
                dev_cur.execute(
                    "UPDATE staff_sessions SET user_id = %s WHERE user_id = %s",
                    (prod_id, dev_id),
                )
                # Delete the old dev placeholder (safe now as dependent tables are truncated)
                dev_cur.execute("DELETE FROM staff_users WHERE id = %s", (dev_id,))
                dev_user_map[prod_email] = prod_id
                continue

        # Standard upsert by ID
        update_assignments = [
            sql.SQL("{} = EXCLUDED.{}").format(sql.Identifier(c), sql.Identifier(c))
            for c in common_cols
            if c != "id"
        ]
        if update_assignments:
            on_conflict_clause = sql.SQL("DO UPDATE SET {}").format(
                sql.SQL(", ").join(update_assignments)
            )
        else:
            on_conflict_clause = sql.SQL("DO NOTHING")

        placeholders = sql.SQL(", ").join([sql.Placeholder() for _ in common_cols])
        insert_sql = sql.SQL(
            """
            INSERT INTO staff_users ({cols})
            VALUES ({placeholders})
            ON CONFLICT (id) {on_conflict}
            """
        ).format(
            cols=col_list_sql,
            placeholders=placeholders,
            on_conflict=on_conflict_clause,
        )
        dev_cur.execute(insert_sql, row)

    return len(prod_rows)


def run_sync(
    prod_url: str,
    dev_url: str,
    tables: list[str] | None = None,
    dry_run: bool = False,
    auto_confirm: bool = False,
    include_empty_prod: bool = False,
):
    prod_host = extract_host(prod_url)
    dev_host = extract_host(dev_url)

    if not prod_host or not dev_host:
        print("ERROR: Invalid PROD_DATABASE_URL or DATABASE_URL.", file=sys.stderr)
        sys.exit(1)

    if prod_host == dev_host:
        print(
            f"SAFETY ABORT: PROD host and DEV host are identical ({prod_host}).",
            file=sys.stderr,
        )
        sys.exit(1)

    print("==================================================")
    print(" Property Advisor Database Sync")
    print("==================================================")
    print(f" Source (PROD):      {sanitize_url_for_display(prod_url)}")
    print(f" Destination (DEV):  {sanitize_url_for_display(dev_url)}")
    print(f" Mode:               {'DRY RUN (no changes)' if dry_run else 'APPLY CHANGES'}")
    print(" Config Preservation: site_configurations & staff_sessions are EXCLUDED.")
    print("==================================================")

    tables_candidate = tables if tables else SYNC_TABLES

    def clean_conn_url(url: str) -> str:
        return url.replace("postgresql+psycopg://", "postgresql://")

    prod_raw_url = clean_conn_url(prod_url)
    dev_raw_url = clean_conn_url(dev_url)

    from psycopg.types.json import JsonDumper

    print("\nConnecting to databases...")
    with psycopg.connect(prod_raw_url) as prod_conn:
        # Enforce read-only transaction on production connection for safety
        prod_conn.execute("SET TRANSACTION READ ONLY;")

        with psycopg.connect(dev_raw_url) as dev_conn:
            # Enable automatic JSON dumping for dict objects (amenities, tool_payload, etc.)
            dev_conn.adapters.register_dumper(dict, JsonDumper)
            print("\n1. Scanning operational tables:")
            active_tables = []
            with prod_conn.cursor() as prod_cur, dev_conn.cursor() as dev_cur:
                prod_cur.execute("SELECT COUNT(*) FROM staff_users")
                prod_staff_cnt = prod_cur.fetchone()[0]
                dev_cur.execute("SELECT COUNT(*) FROM staff_users")
                dev_staff_cnt = dev_cur.fetchone()[0]
                print(f"  - {'staff_users':<25} Prod: {prod_staff_cnt:<6} -> Dev: {dev_staff_cnt}  (Upsert & preserve sessions)")

                for table in tables_candidate:
                    prod_cur.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table)))
                    prod_cnt = prod_cur.fetchone()[0]

                    dev_cur.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table)))
                    dev_cnt = dev_cur.fetchone()[0]

                    if prod_cnt == 0 and not include_empty_prod:
                        print(f"  - {table:<25} Prod: {prod_cnt:<6} -> Dev: {dev_cnt}  (Skipped: Prod has 0 rows)")
                    else:
                        active_tables.append(table)
                        print(f"  - {table:<25} Prod: {prod_cnt:<6} -> Dev: {dev_cnt}  (Will sync)")

            if not active_tables:
                print("\nNo tables to sync.")
                return

            if dry_run:
                print(f"\n[Dry Run Completed] {len(active_tables)} tables queued. No modifications made to DEV.")
                return

            # Interactive confirmation if applying changes
            if not auto_confirm:
                confirm = (
                    input(f"\nAre you sure you want to overwrite {len(active_tables)} DEV tables with PROD data? [y/N]: ")
                    .strip()
                    .lower()
                )
                if confirm not in ("y", "yes"):
                    print("Sync cancelled by user.")
                    sys.exit(0)

            print("\n2. Applying data to DEV inside a single transaction...")
            with dev_conn.transaction():
                with dev_conn.cursor() as dev_cur, prod_conn.cursor() as prod_cur:
                    # Truncate active tables in dev in reverse dependency order
                    rev_tables = [sql.Identifier(t) for t in reversed(active_tables)]
                    truncate_query = sql.SQL("TRUNCATE TABLE {} CASCADE;").format(
                        sql.SQL(", ").join(rev_tables)
                    )
                    print("  Truncating DEV operational tables...")
                    dev_cur.execute(truncate_query)

                    # Now that dependent tables are truncated, sync staff_users
                    print("  Syncing staff_users (aligning IDs & preserving sessions)...")
                    user_count = sync_staff_users(prod_cur, dev_cur)
                    print(f"  Synced {user_count} staff_users.")

                    # Copy rows table by table in forward dependency order
                    for table in active_tables:
                        prod_cols = get_table_columns(prod_cur, table)
                        dev_cols = get_table_columns(dev_cur, table)
                        common_cols = [c for c in prod_cols if c in dev_cols]

                        if not common_cols:
                            print(f"  Warning: No common columns found for {table}, skipping.")
                            continue

                        col_identifiers = [sql.Identifier(c) for c in common_cols]
                        col_list_sql = sql.SQL(", ").join(col_identifiers)

                        select_sql = sql.SQL("SELECT {} FROM {}").format(
                            col_list_sql, sql.Identifier(table)
                        )
                        prod_cur.execute(select_sql)
                        rows = prod_cur.fetchall()

                        if rows:
                            placeholders = sql.SQL(", ").join([sql.Placeholder() for _ in common_cols])
                            insert_sql = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                                sql.Identifier(table), col_list_sql, placeholders
                            )
                            # Batch insert in chunks of 500
                            batch_size = 500
                            for i in range(0, len(rows), batch_size):
                                dev_cur.executemany(insert_sql, rows[i : i + batch_size])

                        print(f"  Copied {len(rows):<5} rows -> {table}")

            print("\nSUCCESS: DEV database successfully synced from PROD!")
            print("Note: `site_configurations` (scanners disabled) & dev `staff_sessions` were preserved.")


def main():
    parser = argparse.ArgumentParser(description="Sync PROD database to DEV database.")
    parser.add_argument("--dry-run", action="store_true", help="Report counts without making any changes.")
    parser.add_argument("-y", "--yes", action="store_true", help="Skip confirmation prompt (for automation/cron).")
    parser.add_argument("--include-empty-prod", action="store_true", help="Also truncate tables where prod has 0 rows.")
    parser.add_argument("--tables", type=str, help="Comma-separated list of specific tables to sync.")
    parser.add_argument("--prod-url", type=str, help="Override PROD_DATABASE_URL.")
    parser.add_argument("--dev-url", type=str, help="Override dev DATABASE_URL.")

    args = parser.parse_args()

    from app.config import get_settings

    settings = get_settings()

    prod_url = args.prod_url or settings.prod_database_url
    dev_url = args.dev_url or settings.database_url

    if not prod_url:
        print("ERROR: PROD_DATABASE_URL is not set in backend/.env or passed via --prod-url.", file=sys.stderr)
        sys.exit(1)

    tables = [t.strip() for t in args.tables.split(",")] if args.tables else None

    run_sync(
        prod_url=prod_url,
        dev_url=dev_url,
        tables=tables,
        dry_run=args.dry_run,
        auto_confirm=args.yes,
        include_empty_prod=args.include_empty_prod,
    )


if __name__ == "__main__":
    main()
